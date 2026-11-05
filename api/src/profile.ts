import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db } from './db/index.js'
import { players } from './db/schema.js'
import { requireLogin } from './games.js'
import { profileSchema } from '../../shared/schemas.js'

export const router = Router()

router.put('/profile', requireLogin, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body)
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const [updated] = await db
    .update(players)
    .set({ tile: parsed.data.tile })
    .where(eq(players.id, res.locals.playerId))
    .returning()
  res.json({ player: updated })
})