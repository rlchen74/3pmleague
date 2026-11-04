import { Router } from 'express'
import { z } from 'zod'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { db } from './db/index.js'
import { players, availability } from './db/schema.js'
import { requireLogin } from './games.js'

export const router = Router()

// The server runs in UTC, so work out "today" in the league's timezone
const LEAGUE_TZ = 'America/Chicago'
const WINDOW_DAYS = 62

const todayStr = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: LEAGUE_TZ })

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Everyone's availability for the coming two months
router.get('/availability', requireLogin, async (_req, res) => {
  const start = todayStr()
  const end = addDays(start, WINDOW_DAYS)
  const rows = await db
    .select({
      playerId: availability.playerId,
      firstName: players.firstName,
      day: availability.day,
    })
    .from(availability)
    .innerJoin(players, eq(availability.playerId, players.id))
    .where(and(gte(availability.day, start), lte(availability.day, end)))
    .orderBy(asc(availability.day), asc(players.firstName))
  res.json(rows)
})

const toggleSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  available: z.boolean(),
})

// Mark myself free (or not free) on one day
router.put('/availability', requireLogin, async (req, res) => {
  const parsed = toggleSchema.safeParse(req.body)
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const { day, available } = parsed.data
  const start = todayStr()
  if (day < start || day > addDays(start, WINDOW_DAYS)) {
    return void res.status(400).json({ error: 'That date is outside the calendar window' })
  }
  const playerId = res.locals.playerId as number
  if (available) {
    await db.insert(availability).values({ playerId, day }).onConflictDoNothing()
  } else {
    await db
      .delete(availability)
      .where(and(eq(availability.playerId, playerId), eq(availability.day, day)))
  }
  res.json({ ok: true })
})