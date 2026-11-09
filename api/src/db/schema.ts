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
  isActive: boolean('is_active').notNull().default(true), 
})

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  playedOn: date('played_on').notNull(),
  enteredBy: integer('entered_by').references(() => players.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  seasonId: integer('season_id').references(() => seasons.id),
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
    dealIns: integer('deal_ins').notNull().default(0),
    bestHand: integer('best_hand').notNull().default(0),
    countsTowardStandings: boolean('counts_toward_standings')
      .notNull()
      .default(true),
  },
  (t) => [unique().on(t.gameId, t.playerId)],
)

export const availability = pgTable(
  'availability',
  {
    id: serial('id').primaryKey(),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
  },
  (t) => [unique().on(t.playerId, t.day)],
)

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  day: date('day').notNull(),
  title: text('title').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => players.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const polls = pgTable('polls', {
  id: serial('id').primaryKey(),
  question: text('question').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => players.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const pollOptions = pgTable('poll_options', {
  id: serial('id').primaryKey(),
  pollId: integer('poll_id')
    .notNull()
    .references(() => polls.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
})

export const pollVotes = pgTable(
  'poll_votes',
  {
    id: serial('id').primaryKey(),
    pollId: integer('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    optionId: integer('option_id')
      .notNull()
      .references(() => pollOptions.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
  },
  (t) => [unique().on(t.pollId, t.playerId)],
)

export const hands = pgTable(
  'hands',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    handNumber: integer('hand_number').notNull(),
    winnerId: integer('winner_id').references(() => players.id),
    discarderId: integer('discarder_id').references(() => players.id),
    selfDraw: boolean('self_draw').notNull().default(false),
    faan: integer('faan'),
  },
  (t) => [unique().on(t.gameId, t.handNumber)],
)

export const unavailability = pgTable(
  'unavailability',
  {
    id: serial('id').primaryKey(),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
  },
  (t) => [unique().on(t.playerId, t.day)],
)

export const seasons = pgTable('seasons', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
})

export const siteContent = pgTable('site_content', {
  key: text('key').primaryKey(),
  body: text('body').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: integer('updated_by').references(() => players.id, { onDelete: 'set null' }),
})

export const gameDrafts = pgTable('game_drafts', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .notNull()
    .references(() => players.id, { onDelete: 'cascade' }),
  data: text('data').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})