import { Router } from 'express'
import { z } from 'zod'
import { and, count, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from './db/index.js'
import { players, unavailability, gameResults } from './db/schema.js'
import { requireLogin } from './games.js'
import { todayStr, addDays, WINDOW_DAYS } from './availability.js'
import { suggestForPlayer, hashSeed } from './pairing.js'
import { currentSeason, gameIdsIn } from './seasonUtils.js'

export const router = Router()

const querySchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shuffle: z.coerce.number().int().min(0).max(1000).default(0),
})

router.get('/pairings', requireLogin, async (req, res) => {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    return void res.status(400).json({ error: 'weekStart is required (YYYY-MM-DD)' })
  }
  const { weekStart, shuffle } = parsed.data
  const today = todayStr()
  const windowEnd = addDays(today, WINDOW_DAYS)
  const from = weekStart < today ? today : weekStart
  const weekEnd = addDays(weekStart, 6)
  const to = weekEnd > windowEnd ? windowEnd : weekEnd

  // Every date in the week we are looking at
  const weekDates: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) weekDates.push(d)

  // Opponent history and game counts only count within the current season
  const season = await currentSeason()
  const inSeason = inArray(gameResults.gameId, gameIdsIn(season.id))

  const other = alias(gameResults, 'other')
  const [offRows, playerRows, playedRows, pairRows] = await Promise.all([
    db
      .select({ playerId: unavailability.playerId, day: unavailability.day })
      .from(unavailability)
      .where(and(gte(unavailability.day, from), lte(unavailability.day, to))),
    db.select({ id: players.id }).from(players).where(eq(players.isActive, true)),
    db
      .select({ playerId: gameResults.playerId, n: count() })
      .from(gameResults)
      .where(and(eq(gameResults.countsTowardStandings, true), inSeason))
      .groupBy(gameResults.playerId),
    // Every pair of players who have shared a table this season (both directions)
    db
      .selectDistinct({ a: gameResults.playerId, b: other.playerId })
      .from(gameResults)
      .innerJoin(
        other,
        and(
          eq(gameResults.gameId, other.gameId),
          sql`${gameResults.playerId} <> ${other.playerId}`,
        ),
      )
      .where(inSeason),
  ])

  // Free days = every date in the week minus the days someone marked off
  const blocked = new Set(offRows.map((r) => `${r.playerId}|${r.day}`))
  const days: Record<number, string[]> = {}
  for (const p of playerRows) {
    days[p.id] = weekDates.filter((d) => !blocked.has(`${p.id}|${d}`))
  }

  const gamesPlayed: Record<number, number> = {}
  for (const r of playedRows) gamesPlayed[r.playerId] = r.n

  const met: Record<number, number[]> = {}
  for (const r of pairRows) (met[r.a] ??= []).push(r.b)

  const seed = hashSeed(`${res.locals.playerId}|${weekStart}|${shuffle}`)
  res.json(suggestForPlayer({ viewerId: res.locals.playerId, days, gamesPlayed, met, seed }))
})