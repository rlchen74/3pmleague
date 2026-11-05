import { desc, eq, isNull } from 'drizzle-orm'
import { db } from './db/index.js'
import { seasons, games } from './db/schema.js'

// The season games are currently entered into; created automatically if none exists
export async function currentSeason() {
  const [open] = await db
    .select()
    .from(seasons)
    .where(isNull(seasons.endedAt))
    .orderBy(desc(seasons.id))
    .limit(1)
  if (open) return open
  const [created] = await db.insert(seasons).values({ name: 'Season 1' }).returning()
  return created
}

// Subquery of the ids of every game in a season, for use inside inArray()
export const gameIdsIn = (seasonId: number) =>
  db.select({ id: games.id }).from(games).where(eq(games.seasonId, seasonId))