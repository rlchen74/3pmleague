import {
  pgTable, serial, text, boolean, integer, date, timestamp, unique,
} from 'drizzle-orm/pg-core'

export const players = pgTable('players', {
  id: serial('id').primaryKey(),
  firstName: text('first_name').notNull().unique(),
  tile: text('tile'),
  avatarUrl: text('avatar_url'),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  playedOn: date('played_on').notNull(),
  enteredBy: integer('entered_by').references(() => players.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const gameResults = pgTable(
  'game_results',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
    seat: integer('seat'),
    score: integer('score').notNull(),
    wins: integer('wins').notNull().default(0),
    bestHand: integer('best_hand').notNull().default(0),
    countsTowardStandings: boolean('counts_toward_standings')
      .notNull()
      .default(true),
  },
  (t) => [unique().on(t.gameId, t.playerId)],
)