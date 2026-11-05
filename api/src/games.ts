import { Router, type RequestHandler } from 'express'
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from './db/index.js'
import { players, games, gameResults, hands } from './db/schema.js'
import { gameSchema, computeResults } from '../../shared/schemas.js'

export const router = Router()

export const requireLogin: RequestHandler = (req, res, next) => {
  const id = Number(req.signedCookies.player_id)
  if (!id) return void res.status(401).json({ error: 'Pick your name first' })
  res.locals.playerId = id
  next()
}

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
      dealIns: sql<number>`coalesce(sum(${gameResults.dealIns}), 0)`.mapWith(Number),
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
  const ids = recent.map((g) => g.id)
  const [results, handRows] = await Promise.all([
    db
      .select({
        gameId: gameResults.gameId,
        playerId: gameResults.playerId,
        firstName: players.firstName,
        score: gameResults.score,
        countsTowardStandings: gameResults.countsTowardStandings,
      })
      .from(gameResults)
      .innerJoin(players, eq(gameResults.playerId, players.id))
      .where(inArray(gameResults.gameId, ids)),
    db.select().from(hands).where(inArray(hands.gameId, ids)).orderBy(asc(hands.handNumber)),
  ])
  res.json(
    recent.map((g) => ({
      id: g.id,
      playedOn: g.playedOn,
      enteredBy: g.enteredBy,
      results: results.filter((r) => r.gameId === g.id),
      hands: handRows
        .filter((h) => h.gameId === g.id)
        .map((h) => ({
          handNumber: h.handNumber,
          winnerId: h.winnerId,
          discarderId: h.discarderId,
          selfDraw: h.selfDraw,
          faan: h.faan,
        })),
    })),
  )
})

router.post('/games', requireLogin, async (req, res) => {
  const parsed = gameSchema.safeParse(req.body)
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const game = parsed.data
  const results = computeResults(game)
  // One transaction: the game, its hands, and every player's result save together or not at all
  const created = await db.transaction(async (tx) => {
    const [g] = await tx
      .insert(games)
      .values({ playedOn: game.playedOn, enteredBy: res.locals.playerId })
      .returning()
    await tx.insert(hands).values(
      game.hands.map((h, i) => ({
        gameId: g.id,
        handNumber: i + 1,
        winnerId: h.winnerId,
        discarderId: h.discarderId,
        selfDraw: h.selfDraw,
        faan: h.faan,
      })),
    )
    await tx.insert(gameResults).values(
      results.map((r, i) => ({
        gameId: g.id,
        playerId: r.playerId,
        seat: i + 1,
        score: r.score,
        wins: r.wins,
        dealIns: r.dealIns,
        countsTowardStandings: r.countsTowardStandings,
      })),
    )
    return g
  })
  res.status(201).json(created)
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
  await db.delete(games).where(eq(games.id, id)) // results and hands cascade-delete
  res.json({ ok: true })
})