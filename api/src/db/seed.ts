import { db } from './index.js'
import { players } from './schema.js'

const names = [
  'Robert', 'Mei', 'Daniel', 'Priya', 'Tom', 'Sofia', 'Hiro', 'Alex',
]

await db
  .insert(players)
  .values(names.map((firstName) => ({ firstName })))
  .onConflictDoNothing()

console.log(`Seeded ${names.length} players`)
process.exit(0)