import { Router } from 'express'
import { pollSchema, voteSchema } from '../../shared/schemas.js'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from './db/index.js'
import { players, polls, pollOptions, pollVotes } from './db/schema.js'
import { requireLogin } from './games.js'

export const router = Router()

router.get('/polls', requireLogin, async (_req, res) => {
  const pollRows = await db.select().from(polls).orderBy(desc(polls.id))
  if (pollRows.length === 0) return void res.json([])
  const ids = pollRows.map((p) => p.id)

  const [opts, votes] = await Promise.all([
    db
      .select()
      .from(pollOptions)
      .where(inArray(pollOptions.pollId, ids))
      .orderBy(asc(pollOptions.id)),
    db
      .select({
        pollId: pollVotes.pollId,
        optionId: pollVotes.optionId,
        playerId: pollVotes.playerId,
        firstName: players.firstName,
      })
      .from(pollVotes)
      .innerJoin(players, eq(pollVotes.playerId, players.id))
      .where(inArray(pollVotes.pollId, ids)),
  ])

  const me = Number(res.locals.playerId)
  res.json(
    pollRows.map((p) => ({
      id: p.id,
      question: p.question,
      createdBy: p.createdBy,
      myVote: votes.find((v) => v.pollId === p.id && v.playerId === me)?.optionId ?? null,
      options: opts
        .filter((o) => o.pollId === p.id)
        .map((o) => ({
          id: o.id,
          label: o.label,
          voters: votes.filter((v) => v.optionId === o.id).map((v) => v.firstName),
        })),
    })),
  )
})

router.post('/polls', requireLogin, async (req, res) => {
  const parsed = pollSchema.safeParse(req.body)
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const { question, options } = parsed.data
  const poll = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(polls)
      .values({ question, createdBy: res.locals.playerId })
      .returning()
    await tx.insert(pollOptions).values(options.map((label) => ({ pollId: p.id, label })))
    return p
  })
  res.status(201).json(poll)
})

router.put('/polls/:id/vote', requireLogin, async (req, res) => {
  const pollId = Number(req.params.id)
  const parsed = voteSchema.safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'Invalid vote' })

  const [option] = await db
    .select()
    .from(pollOptions)
    .where(and(eq(pollOptions.id, parsed.data.optionId), eq(pollOptions.pollId, pollId)))
  if (!option) return void res.status(404).json({ error: 'Option not found' })

  await db
    .insert(pollVotes)
    .values({ pollId, optionId: option.id, playerId: res.locals.playerId })
    .onConflictDoUpdate({
      target: [pollVotes.pollId, pollVotes.playerId],
      set: { optionId: option.id },
    })
  res.json({ ok: true })
})

// Only the creator (or an admin) can delete a poll
router.delete('/polls/:id', requireLogin, async (req, res) => {
  const id = Number(req.params.id)
  const [poll] = await db.select().from(polls).where(eq(polls.id, id))
  if (!poll) return void res.status(404).json({ error: 'Poll not found' })
  const [me] = await db.select().from(players).where(eq(players.id, res.locals.playerId))
  if (poll.createdBy !== me.id && !me.isAdmin) {
    return void res.status(403).json({ error: 'Only the creator can delete this poll' })
  }
  await db.delete(polls).where(eq(polls.id, id))
  res.json({ ok: true })
})