import { Router } from 'express'
import { z } from 'zod'
import { and, count, eq, gte, lte, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from './db/index.js'
import { players, availability, gameResults } from './db/schema.js'
import { requireLogin } from './games.js'
import { todayStr, addDays } from './availability.js'
import { suggestTables } from './pairing.js'

export const router = Router()

const querySchema = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })

router.get('/pairings', requireLogin, async (req, res) => {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    return void res.status(400).json({ error: 'weekStart is required (YYYY-MM-DD)' })
  }
  const { weekStart } = parsed.data
  const today = todayStr()
  const from = weekStart < today ? today : weekStart
  const to = addDays(weekStart, 6)

  const other = alias(gameResults, 'other')
  const [slotRows, playerRows, playedRows, pairRows] = await Promise.all([
    db
      .select({ playerId: availability.playerId, day: availability.day })
      .from(availability)
      .where(and(gte(availability.day, from), lte(availability.day, to))),
    db.select({ id: players.id }).from(players),
    db
      .select({ playerId: gameResults.playerId, n: count() })
      .from(gameResults)
      .where(eq(gameResults.countsTowardStandings, true))
      .groupBy(gameResults.playerId),
    // Every pair of players who have shared a table (both directions)
    db
      .selectDistinct({ a: gameResults.playerId, b: other.playerId })
      .from(gameResults)
      .innerJoin(
        other,
        and(
          eq(gameResults.gameId, other.gameId),
          sql`${gameResults.playerId} <> ${other.playerId}`,
        ),
      ),
  ])

  const days: Record<number, string[]> = {}
  for (const p of playerRows) days[p.id] = []
  for (const s of slotRows) days[s.playerId]?.push(s.day)

  const gamesPlayed: Record<number, number> = {}
  for (const r of playedRows) gamesPlayed[r.playerId] = r.n

  const met: Record<number, number[]> = {}
  for (const r of pairRows) (met[r.a] ??= []).push(r.b)

  res.json(suggestTables({ days, gamesPlayed, met }))
})