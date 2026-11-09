import { Router } from 'express'
import { and, count, desc, eq } from 'drizzle-orm'
import { db } from './db/index.js'
import { gameDrafts } from './db/schema.js'
import { requireLogin } from './games.js'
import { draftSchema, MAX_DRAFTS } from '../../shared/schemas.js'

export const router = Router()

function parseJson(data: string) {
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

// My games in progress, most recently touched first
router.get('/drafts', requireLogin, async (_req, res) => {
  const rows = await db
    .select()
    .from(gameDrafts)
    .where(eq(gameDrafts.ownerId, res.locals.playerId))
    .orderBy(desc(gameDrafts.updatedAt))
  res.json(
    rows.flatMap((r) => {
      const data = parseJson(r.data)
      return data ? [{ id: r.id, updatedAt: r.updatedAt, data }] : []
    }),
  )
})

router.post('/drafts', requireLogin, async (req, res) => {
  const parsed = draftSchema.safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'Invalid draft' })
  const [{ n }] = await db
    .select({ n: count() })
    .from(gameDrafts)
    .where(eq(gameDrafts.ownerId, res.locals.playerId))
  if (n >= MAX_DRAFTS) {
    return void res.status(400).json({
      error: `You already have ${MAX_DRAFTS} games in progress. Finish or discard one first.`,
    })
  }
  const [created] = await db
    .insert(gameDrafts)
    .values({ ownerId: res.locals.playerId, data: JSON.stringify(parsed.data) })
    .returning()
  res.status(201).json({ id: created.id })
})

router.put('/drafts/:id', requireLogin, async (req, res) => {
  const id = Number(req.params.id)
  const parsed = draftSchema.safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'Invalid draft' })
  const [updated] = await db
    .update(gameDrafts)
    .set({ data: JSON.stringify(parsed.data), updatedAt: new Date() })
    .where(and(eq(gameDrafts.id, id), eq(gameDrafts.ownerId, res.locals.playerId)))
    .returning()
  if (!updated) return void res.status(404).json({ error: 'Draft not found' })
  res.json({ ok: true })
})

router.delete('/drafts/:id', requireLogin, async (req, res) => {
  const id = Number(req.params.id)
  await db
    .delete(gameDrafts)
    .where(and(eq(gameDrafts.id, id), eq(gameDrafts.ownerId, res.locals.playerId)))
  res.json({ ok: true })
})