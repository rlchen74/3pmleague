import 'dotenv/config'
import { router as availabilityRouter } from './availability.js'
import express from 'express'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { loginSchema } from '../../shared/schemas.js'
import { asc, eq } from 'drizzle-orm'
import { db } from './db/index.js'
import cors from 'cors'
import { players } from './db/schema.js'
import { router as gamesRouter } from './games.js'
import { router as pairingsRouter } from './pairings.js'
import { router as eventsRouter } from './events.js'
import { router as pollsRouter } from './polls.js'
import { router as profileRouter } from './profile.js'

const sessionSecret = process.env.SESSION_SECRET
const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
if (!sessionSecret || !turnstileSecret) {
  throw new Error('Missing SESSION_SECRET or TURNSTILE_SECRET_KEY in .env')
}

const app = express()
app.set('trust proxy', 1) // Render sits behind a proxy; needed for secure cookies and rate limits
app.use(
  cors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser(sessionSecret))

const COOKIE = 'player_id'
const cookieOptions = {
  signed: true,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 1000 * 60 * 60 * 24 * 90, // 90 days
}

// Ask Cloudflare whether the Turnstile token is genuine
async function verifyTurnstile(token: string): Promise<boolean> {
  const resp = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body: new URLSearchParams({ secret: turnstileSecret!, response: token }),
    },
  )
  const data = (await resp.json()) as { success: boolean }
  return data.success
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

// Public list of names for the login dropdown
app.get('/api/players', async (_req, res) => {
  const rows = await db
    .select({ id: players.id, firstName: players.firstName })
    .from(players)
    .orderBy(asc(players.firstName))
  res.json(rows)
})

// Who am I? (reads the signed cookie)
app.get('/api/me', async (req, res) => {
  const id = Number(req.signedCookies[COOKIE])
  if (!id) return res.json({ player: null })
  const [player] = await db.select().from(players).where(eq(players.id, id))
  res.json({ player: player ?? null })
})

// Log in: pick a name + pass Turnstile
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 })

app.post('/api/session', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' })
  const { playerId, turnstileToken } = parsed.data

  if (!(await verifyTurnstile(turnstileToken))) {
    return res.status(403).json({ error: 'Human check failed, try again' })
  }
  const [player] = await db.select().from(players).where(eq(players.id, playerId))
  if (!player) return res.status(404).json({ error: 'Player not found' })

  res.cookie(COOKIE, String(player.id), cookieOptions)
  res.json({ player })
})

app.post('/api/logout', (_req, res) => {
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined })
  res.json({ ok: true })
})

app.use('/api', gamesRouter)
app.use('/api', availabilityRouter)
app.use('/api', pairingsRouter)
app.use('/api', eventsRouter)
app.use('/api', pollsRouter)
app.use('/api', profileRouter)

const port = Number(process.env.PORT) || 3001
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})