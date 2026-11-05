import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')

// Mahjong tiles live in U+1F000 to U+1F029 (no joker)
const isTile = (s: string) => {
  const chars = [...s]
  if (chars.length !== 1) return false
  const cp = chars[0].codePointAt(0)!
  return cp >= 0x1f000 && cp <= 0x1f029
}

// ---- Scoring rules: edit these to change the league's formula ----
export const HANDS_PER_GAME = 8
export const FAAN_MIN = 3
export const FAAN_MAX = 13
export const winPoints = (faan: number) => faan * 2 - 3
export const DEAL_IN_PENALTY = 3
export const SELF_DRAW_PENALTY = 2

const playerId = z.number().int().positive()

export const loginSchema = z.object({
  playerId,
  turnstileToken: z.string().min(1),
})

const handShape = z.object({
  isDraw: z.boolean(),
  winnerId: playerId.nullable(),
  selfDraw: z.boolean(),
  discarderId: playerId.nullable(),
  faan: z.number().int().nullable(),
})

export const gameSchema = z
  .object({
    playedOn: isoDate,
    players: z
      .array(z.object({ playerId, countsTowardStandings: z.boolean().default(true) }))
      .length(4, 'A game needs exactly 4 players'),
    hands: z
      .array(handShape)
      .length(HANDS_PER_GAME, `A game needs exactly ${HANDS_PER_GAME} hands`),
  })
  .superRefine((g, ctx) => {
    const ids = g.players.map((p) => p.playerId)
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: 'Each player can only appear once' })
      return
    }
    g.hands.forEach((h, i) => {
      const bad = (message: string) =>
        ctx.addIssue({ code: 'custom', message: `Hand ${i + 1}: ${message}` })
      if (h.isDraw) {
        if (h.winnerId !== null || h.discarderId !== null || h.selfDraw || h.faan !== null) {
          bad('a draw has no winner, deal-in, or faan')
        }
        return
      }
      if (h.winnerId === null || !ids.includes(h.winnerId)) return bad('choose a winner')
      if (h.faan === null || h.faan < FAAN_MIN || h.faan > FAAN_MAX) {
        return bad(`faan must be between ${FAAN_MIN} and ${FAAN_MAX}`)
      }
      if (h.selfDraw) {
        if (h.discarderId !== null) bad('a self-draw has no deal-in player')
      } else {
        if (h.discarderId === null || !ids.includes(h.discarderId)) return bad('choose who dealt in')
        if (h.discarderId === h.winnerId) bad('the winner cannot deal in to themselves')
      }
    })
  })

export const availabilitySchema = z.object({
  day: isoDate,
  unavailable: z.boolean(),
})

export const eventSchema = z.object({
  day: isoDate,
  title: z
    .string()
    .trim()
    .min(1, 'Give the event a title')
    .max(80, 'Keep it under 80 characters'),
})

export const pollSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'Write a question')
    .max(120, 'Keep the question under 120 characters'),
  options: z
    .array(
      z.string().trim().min(1, 'Options cannot be blank').max(60, 'Keep options under 60 characters'),
    )
    .min(2, 'Add at least 2 options')
    .max(6, 'At most 6 options'),
})

export const voteSchema = z.object({
  optionId: z.number().int().positive(),
})

export const profileSchema = z.object({
  tile: z
    .string()
    .nullable()
    .refine((t) => t === null || isTile(t), 'That is not a mahjong tile'),
})

export type GameInput = z.infer<typeof gameSchema>
export type HandInput = z.infer<typeof handShape>
export type EventInput = z.infer<typeof eventSchema>
export type PollInput = z.infer<typeof pollSchema>

// Point changes for one hand, per player id
export function handDeltas(h: HandInput, ids: number[]): Record<number, number> {
  const d: Record<number, number> = {}
  for (const id of ids) d[id] = 0
  if (h.isDraw || h.winnerId === null || h.faan === null) return d
  d[h.winnerId] += winPoints(h.faan)
  if (h.selfDraw) {
    for (const id of ids) {
      if (id !== h.winnerId) d[id] -= SELF_DRAW_PENALTY
    }
  } else if (h.discarderId !== null) {
    d[h.discarderId] -= DEAL_IN_PENALTY
  }
  return d
}

// Final per-player results for a whole game
export function computeResults(game: GameInput) {
  const ids = game.players.map((p) => p.playerId)
  const score: Record<number, number> = {}
  const wins: Record<number, number> = {}
  const dealIns: Record<number, number> = {}
  for (const id of ids) {
    score[id] = 0
    wins[id] = 0
    dealIns[id] = 0
  }
  for (const h of game.hands) {
    const d = handDeltas(h, ids)
    for (const id of ids) score[id] += d[id]
    if (!h.isDraw && h.winnerId !== null) {
      wins[h.winnerId] += 1
      if (!h.selfDraw && h.discarderId !== null) dealIns[h.discarderId] += 1
    }
  }
  return game.players.map((p) => ({
    playerId: p.playerId,
    score: score[p.playerId],
    wins: wins[p.playerId],
    dealIns: dealIns[p.playerId],
    countsTowardStandings: p.countsTowardStandings,
  }))
}

// Validate data and throw an Error with the first problem's message
export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data)
  if (!r.success) throw new Error(r.error.issues[0].message)
  return r.data
}