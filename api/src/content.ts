import { Router } from 'express'
import { db } from './db/index.js'
import { siteContent } from './db/schema.js'
import { requireLogin, requireAdmin } from './games.js'
import { contentSchema } from '../../shared/schemas.js'

export const router = Router()

// Shown until an admin saves their own text
const DEFAULTS: Record<string, string> = {
  rules: `We play Hong Kong mahjong with the league house rules.
Each player plays 5 league games, always against opponents they have not faced.
Every winning hand must be worth at least 3 faan.
A winner scores 2 x faan - 3 points. A deal-in loses 3. On a self-draw, each other player loses 2. A draw changes nothing.
Report scores on the Scoring tab right after your game.`,
  info: `Organizer: add your name and contact here.
Games are self-scheduled. Use the Calendar tab to find players and tables.`,
}

router.get('/content', requireLogin, async (_req, res) => {
  const rows = await db.select().from(siteContent)
  const out = { ...DEFAULTS }
  for (const r of rows) out[r.key] = r.body
  res.json(out)
})

router.put('/content', requireAdmin, async (req, res) => {
  const parsed = contentSchema.safeParse(req.body)
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const { key, body } = parsed.data
  await db
    .insert(siteContent)
    .values({ key, body, updatedBy: res.locals.playerId })
    .onConflictDoUpdate({
      target: siteContent.key,
      set: { body, updatedAt: new Date(), updatedBy: res.locals.playerId },
    })
  res.json({ ok: true })
})