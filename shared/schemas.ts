import { z } from 'zod'

// Flip to true if scores in a game must always add up to zero
export const REQUIRE_ZERO_SUM = false

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')

// Mahjong tiles live in U+1F000 to U+1F029 (no joker)
const isTile = (s: string) => {
  const chars = [...s]
  if (chars.length !== 1) return false
  const cp = chars[0].codePointAt(0)!
  return cp >= 0x1f000 && cp <= 0x1f029
}

export const loginSchema = z.object({
  playerId: z.number().int().positive(),
  turnstileToken: z.string().min(1),
})

export const gameResultSchema = z.object({
  playerId: z.number().int().positive(),
  score: z.number().int(),
  wins: z.number().int().min(0).default(0),
  bestHand: z.number().int().min(0).default(0),
  countsTowardStandings: z.boolean().default(true),
})

export const gameSchema = z
  .object({
    playedOn: isoDate,
    results: z.array(gameResultSchema).length(4, 'A game needs exactly 4 players'),
  })
  .refine((g) => new Set(g.results.map((r) => r.playerId)).size === 4, {
    message: 'Each player can only appear once',
  })
  .refine(
    (g) => !REQUIRE_ZERO_SUM || g.results.reduce((s, r) => s + r.score, 0) === 0,
    { message: 'Scores must add up to zero' },
  )

export const availabilitySchema = z.object({
  day: isoDate,
  available: z.boolean(),
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
export type EventInput = z.infer<typeof eventSchema>
export type PollInput = z.infer<typeof pollSchema>

// Validate data and throw an Error with the first problem's message
export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data)
  if (!r.success) throw new Error(r.error.issues[0].message)
  return r.data
}