import { Router } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from './db/index.js'
import { players } from './db/schema.js'
import { requireLogin } from './games.js'

export const router = Router()

// Mahjong tiles live in the Unicode range U+1F000 to U+1F029
const isTile = (s: string) => {
  const chars = [...s]
  if (chars.length !== 1) return false
  const cp = chars[0].codePointAt(0)!
  return cp >= 0x1f000 && cp <= 0x1f029
}

router.put('/profile', requireLogin, async (req, res) => {
  const parsed = z.object({ tile: z.string().nullable() }).safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'Invalid request' })
  const { tile } = parsed.data
  if (tile !== null && !isTile(tile)) {
    return void res.status(400).json({ error: 'That is not a mahjong tile' })
  }
  const [updated] = await db
    .update(players)
    .set({ tile })
    .where(eq(players.id, res.locals.playerId))
    .returning()
  res.json({ player: updated })
})