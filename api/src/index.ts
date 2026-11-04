import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { db } from './db/index.js'
import { players } from './db/schema.js'

const sessionSecret = process.env.SESSION_SECRET
const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
if (!sessionSecret || !turnstileSecret) {
  throw new Error('Missing SESSION_SECRET or TURNSTILE_SECRET_KEY in .env')
}

const app = express()
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
const loginSchema = z.object({
  playerId: z.number().int().positive(),
  turnstileToken: z.string().min(1),
})

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

const port = Number(process.env.PORT) || 3001
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})