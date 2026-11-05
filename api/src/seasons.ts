import { Router } from 'express'
import { desc, isNull } from 'drizzle-orm'
import { db } from './db/index.js'
import { seasons } from './db/schema.js'
import { requireLogin, requireAdmin } from './games.js'
import { currentSeason } from './seasonUtils.js'
import { newSeasonSchema } from '../../shared/schemas.js'

export const router = Router()

router.get('/seasons', requireLogin, async (_req, res) => {
  const current = await currentSeason()
  const rows = await db.select().from(seasons).orderBy(desc(seasons.id))
  res.json(rows.map((s) => ({ id: s.id, name: s.name, isCurrent: s.id === current.id })))
})

// Ends the current season and starts a new one
router.post('/seasons/new', requireAdmin, async (req, res) => {
  const parsed = newSeasonSchema.safeParse(req.body)
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const created = await db.transaction(async (tx) => {
    await tx.update(seasons).set({ endedAt: new Date() }).where(isNull(seasons.endedAt))
    const [s] = await tx.insert(seasons).values({ name: parsed.data.name }).returning()
    return s
  })
  res.status(201).json(created)
})