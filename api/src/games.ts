import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from './db/index.js'
import { players, games, gameResults } from './db/schema.js'

export const router = Router()

// Flip to true if your league's scores in a game always add up to zero
const REQUIRE_ZERO_SUM = false

export const requireLogin: RequestHandler = (req, res, next) => {
  const id = Number(req.signedCookies.player_id)
  if (!id) return void res.status(401).json({ error: 'Pick your name first' })
  res.locals.playerId = id
  next()
}

const resultSchema = z.object({
  playerId: z.number().int().positive(),
  score: z.number().int(),
  wins: z.number().int().min(0).default(0),
  bestHand: z.number().int().min(0).default(0),
  countsTowardStandings: z.boolean().default(true),
})

const gameSchema = z
  .object({
    playedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
    results: z.array(resultSchema).length(4, 'A game needs exactly 4 players'),
  })
  .refine((g) => new Set(g.results.map((r) => r.playerId)).size === 4, {
    message: 'Each player can only appear once',
  })
  .refine(
    (g) => !REQUIRE_ZERO_SUM || g.results.reduce((s, r) => s + r.score, 0) === 0,
    { message: 'Scores must add up to zero' },
  )

// Standings are calculated from game results, never stored
router.get('/standings', requireLogin, async (_req, res) => {
  const rows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      tile: players.tile,
      games: count(gameResults.id),
      points: sql<number>`coalesce(sum(${gameResults.score}), 0)`.mapWith(Number),
      wins: sql<number>`coalesce(sum(${gameResults.wins}), 0)`.mapWith(Number),
      bestHand: sql<number>`coalesce(max(${gameResults.bestHand}), 0)`.mapWith(Number),
    })
    .from(players)
    .leftJoin(
      gameResults,
      and(
        eq(gameResults.playerId, players.id),
        eq(gameResults.countsTowardStandings, true),
      ),
    )
    .groupBy(players.id, players.firstName, players.tile)
  rows.sort((a, b) => b.points - a.points || a.firstName.localeCompare(b.firstName))
  res.json(rows)
})

router.get('/games', requireLogin, async (_req, res) => {
  const recent = await db.select().from(games).orderBy(desc(games.id)).limit(10)
  if (recent.length === 0) return void res.json([])
  const results = await db
    .select({
      gameId: gameResults.gameId,
      playerId: gameResults.playerId,
      firstName: players.firstName,
      score: gameResults.score,
      wins: gameResults.wins,
      bestHand: gameResults.bestHand,
      countsTowardStandings: gameResults.countsTowardStandings,
    })
    .from(gameResults)
    .innerJoin(players, eq(gameResults.playerId, players.id))
    .where(inArray(gameResults.gameId, recent.map((g) => g.id)))
  res.json(
    recent.map((g) => ({
      id: g.id,
      playedOn: g.playedOn,
      enteredBy: g.enteredBy,
      results: results.filter((r) => r.gameId === g.id),
    })),
  )
})

router.post('/games', requireLogin, async (req, res) => {
  const parsed = gameSchema.safeParse(req.body)
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const { playedOn, results } = parsed.data
  // A transaction: either the game and all 4 results save, or nothing does
  const game = await db.transaction(async (tx) => {
    const [g] = await tx
      .insert(games)
      .values({ playedOn, enteredBy: res.locals.playerId })
      .returning()
    await tx.insert(gameResults).values(results.map((r) => ({ ...r, gameId: g.id })))
    return g
  })
  res.status(201).json(game)
})

// Only the person who entered a game (or an admin) can delete it
router.delete('/games/:id', requireLogin, async (req, res) => {
  const id = Number(req.params.id)
  const [game] = await db.select().from(games).where(eq(games.id, id))
  if (!game) return void res.status(404).json({ error: 'Game not found' })
  const [me] = await db.select().from(players).where(eq(players.id, res.locals.playerId))
  if (game.enteredBy !== me.id && !me.isAdmin) {
    return void res.status(403).json({ error: 'Only the person who entered it can delete it' })
  }
  await db.delete(games).where(eq(games.id, id)) // results cascade-delete
  res.json({ ok: true })
})