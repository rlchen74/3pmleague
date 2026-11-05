import { Router } from 'express'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { db } from './db/index.js'
import { players, unavailability } from './db/schema.js'
import { requireLogin } from './games.js'
import { availabilitySchema } from '../../shared/schemas.js'

export const router = Router()

// The server runs in UTC, so work out "today" in the league's timezone
const LEAGUE_TZ = 'America/Chicago'
export const WINDOW_DAYS = 62

export const todayStr = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: LEAGUE_TZ })

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Days people have marked themselves unavailable
router.get('/unavailability', requireLogin, async (_req, res) => {
  const start = todayStr()
  const end = addDays(start, WINDOW_DAYS)
  const rows = await db
    .select({
      playerId: unavailability.playerId,
      firstName: players.firstName,
      day: unavailability.day,
    })
    .from(unavailability)
    .innerJoin(players, eq(unavailability.playerId, players.id))
    .where(and(gte(unavailability.day, start), lte(unavailability.day, end)))
    .orderBy(asc(unavailability.day), asc(players.firstName))
  res.json(rows)
})

router.put('/unavailability', requireLogin, async (req, res) => {
  const parsed = availabilitySchema.safeParse(req.body)
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const { day, unavailable } = parsed.data
  const start = todayStr()
  if (day < start || day > addDays(start, WINDOW_DAYS)) {
    return void res.status(400).json({ error: 'That date is outside the calendar window' })
  }
  const playerId = res.locals.playerId as number
  if (unavailable) {
    await db.insert(unavailability).values({ playerId, day }).onConflictDoNothing()
  } else {
    await db
      .delete(unavailability)
      .where(and(eq(unavailability.playerId, playerId), eq(unavailability.day, day)))
  }
  res.json({ ok: true })
})