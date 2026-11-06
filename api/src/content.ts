import { Router } from 'express'
import { db } from './db/index.js'
import { siteContent } from './db/schema.js'
import { requireLogin, requireAdmin } from './games.js'
import { contentSchema } from '../../shared/schemas.js'

export const router = Router()

// Shown until an admin saves their own text
const DEFAULTS: Record<string, string> = {
  rules: `Season 0: November 4 - December 31st
Hong Kong style mahjong! Hands are scored with standard rules and 3 faan minimum (see mahjongscoring.net) and converted to points for the leaderboard.
A winner scores ((2 x faan) - 3) points. A deal-in loses 3. On a self-draw, each other player loses 2. On a draw, no one wins! :)
Each player plays 5 league games, always against opponents they have not faced (there will be a few games where we may have to overlap, TBD).
Buy-in is $20, with the grand prize being a nice lil mahjong set (details TBD). Fee is not due till season end.
Report scores on the Scoring tab right after your game.
Games are self-scheduled!!! Use the Calendar tab to find matchup and table suggestions. To make things easier, you can also block out days on the Calendar that you are out-of-town/busy.`,
  info: `Commissioners: Robert Chen (2172812931), Alex Kim (8182539546). Please contact with any questions, issues, interpersonal conflict resolution, or life advice.`,
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