import { Router } from 'express'
import { eventSchema } from '../../shared/schemas.js'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { db } from './db/index.js'
import { players, events } from './db/schema.js'
import { requireLogin } from './games.js'
import { todayStr, addDays } from './availability.js'

export const router = Router()
const WINDOW_DAYS = 62

router.get('/events', requireLogin, async (_req, res) => {
  const start = todayStr()
  const end = addDays(start, WINDOW_DAYS)
  const rows = await db
    .select({
      id: events.id,
      day: events.day,
      title: events.title,
      createdBy: events.createdBy,
      firstName: players.firstName,
    })
    .from(events)
    .innerJoin(players, eq(events.createdBy, players.id))
    .where(and(gte(events.day, start), lte(events.day, end)))
    .orderBy(asc(events.day), asc(events.id))
  res.json(rows)
})

router.post('/events', requireLogin, async (req, res) => {
  const parsed = eventSchema.safeParse(req.body)
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const { day, title } = parsed.data
  const start = todayStr()
  if (day < start || day > addDays(start, WINDOW_DAYS)) {
    return void res.status(400).json({ error: 'That date is outside the calendar window' })
  }
  const [created] = await db
    .insert(events)
    .values({ day, title, createdBy: res.locals.playerId })
    .returning()
  res.status(201).json(created)
})

// Only the creator (or an admin) can remove an event
router.delete('/events/:id', requireLogin, async (req, res) => {
  const id = Number(req.params.id)
  const [event] = await db.select().from(events).where(eq(events.id, id))
  if (!event) return void res.status(404).json({ error: 'Event not found' })
  const [me] = await db.select().from(players).where(eq(players.id, res.locals.playerId))
  if (event.createdBy !== me.id && !me.isAdmin) {
    return void res.status(403).json({ error: 'Only the creator can remove this' })
  }
  await db.delete(events).where(eq(events.id, id))
  res.json({ ok: true })
})