import { Router } from 'express'
import { asc, eq } from 'drizzle-orm'
import { db } from './db/index.js'
import { players } from './db/schema.js'
import { requireAdmin } from './games.js'
import { newPlayerSchema, activeSchema } from '../../shared/schemas.js'

export const router = Router()

router.get('/admin/players', requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      isActive: players.isActive,
      isAdmin: players.isAdmin,
    })
    .from(players)
    .orderBy(asc(players.firstName))
  res.json(rows)
})

router.post('/admin/players', requireAdmin, async (req, res) => {
  const parsed = newPlayerSchema.safeParse(req.body)
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const [created] = await db
    .insert(players)
    .values({ firstName: parsed.data.firstName })
    .onConflictDoNothing()
    .returning()
  if (!created) return void res.status(409).json({ error: 'That name is already taken' })
  res.status(201).json(created)
})

router.put('/admin/players/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const parsed = activeSchema.safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'Invalid request' })
  if (id === res.locals.playerId && !parsed.data.isActive) {
    return void res.status(400).json({ error: 'You cannot deactivate yourself' })
  }
  const [updated] = await db
    .update(players)
    .set({ isActive: parsed.data.isActive })
    .where(eq(players.id, id))
    .returning()
  if (!updated) return void res.status(404).json({ error: 'Player not found' })
  res.json({ ok: true })
})