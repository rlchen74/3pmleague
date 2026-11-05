import { Router, type RequestHandler } from 'express'
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from './db/index.js'
import { players, games, gameResults, hands } from './db/schema.js'
import { currentSeason, gameIdsIn } from './seasonUtils.js'
import { gameSchema, computeResults } from '../../shared/schemas.js'

export const router = Router()

export const requireLogin: RequestHandler = (req, res, next) => {
  const id = Number(req.signedCookies.player_id)
  if (!id) return void res.status(401).json({ error: 'Pick your name first' })
  res.locals.playerId = id
  next()
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const id = Number(req.signedCookies.player_id)
  if (!id) return void res.status(401).json({ error: 'Pick your name first' })
  const [me] = await db.select().from(players).where(eq(players.id, id))
  if (!me?.isAdmin) return void res.status(403).json({ error: 'Admins only' })
  res.locals.playerId = id
  next()
}

// Standings are calculated from game results for one season, never stored
router.get('/standings', requireLogin, async (req, res) => {
  const requested = Number(req.query.seasonId)
  const seasonId =
    Number.isInteger(requested) && requested > 0 ? requested : (await currentSeason()).id
  const rows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      tile: players.tile,
      isActive: players.isActive,
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
        inArray(gameResults.gameId, gameIdsIn(seasonId)),
      ),
    )
    .groupBy(players.id, players.firstName, players.tile, players.isActive)
  // Inactive players only appear if they played in this season
  const shown = rows.filter((r) => r.isActive || r.games > 0)
  shown.sort((a, b) => b.points - a.points || a.firstName.localeCompare(b.firstName))
  res.json(shown)
})

// Recent games of the current season
router.get('/games', requireLogin, async (_req, res) => {
  const season = await currentSeason()
  const recent = await db
    .select()
    .from(games)
    .where(eq(games.seasonId, season.id))
    .orderBy(desc(games.id))
    .limit(20)
  if (recent.length === 0) return void res.json([])
  const ids = recent.map((g) => g.id)
  const [results, handRows] = await Promise.all([
    db
      .select({
        gameId: gameResults.gameId,
        playerId: gameResults.playerId,
        firstName: players.firstName,
        seat: gameResults.seat,
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
      results: results
        .filter((r) => r.gameId === g.id)
        .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0)),
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
  const season = await currentSeason()
  // One transaction: the game, its hands, and every player's result save together or not at all
  const created = await db.transaction(async (tx) => {
    const [g] = await tx
      .insert(games)
      .values({
        playedOn: game.playedOn,
        enteredBy: res.locals.playerId,
        seasonId: season.id,
      })
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

// Replace a game's date, players, and hands. Only the creator or an admin can do this.
router.put('/games/:id', requireLogin, async (req, res) => {
  const id = Number(req.params.id)
  const parsed = gameSchema.safeParse(req.body)
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const [game] = await db.select().from(games).where(eq(games.id, id))
  if (!game) return void res.status(404).json({ error: 'Game not found' })
  const [me] = await db.select().from(players).where(eq(players.id, res.locals.playerId))
  if (game.enteredBy !== me.id && !me.isAdmin) {
    return void res.status(403).json({ error: 'Only the person who entered it can edit it' })
  }
  const data = parsed.data
  const results = computeResults(data)
  await db.transaction(async (tx) => {
    await tx.update(games).set({ playedOn: data.playedOn }).where(eq(games.id, id))
    await tx.delete(hands).where(eq(hands.gameId, id))
    await tx.delete(gameResults).where(eq(gameResults.gameId, id))
    await tx.insert(hands).values(
      data.hands.map((h, i) => ({
        gameId: id,
        handNumber: i + 1,
        winnerId: h.winnerId,
        discarderId: h.discarderId,
        selfDraw: h.selfDraw,
        faan: h.faan,
      })),
    )
    await tx.insert(gameResults).values(
      results.map((r, i) => ({
        gameId: id,
        playerId: r.playerId,
        seat: i + 1,
        score: r.score,
        wins: r.wins,
        dealIns: r.dealIns,
        countsTowardStandings: r.countsTowardStandings,
      })),
    )
  })
  res.json({ ok: true })
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