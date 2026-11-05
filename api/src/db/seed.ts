import { db } from './index.js'
import { players } from './schema.js'

const names = [
  'Adamo', 'Aileen', 'Alex', 'Charis', 'Dennis', 'Hac', 'Haley', "J'Ana", 'Jas', 'Justice', 'Kat', 'Monica', 'Marcus', 'Michael', 'Michelle', 'Peter', 'Phil', 'Robert', 'Yong'
]

await db
  .insert(players)
  .values(names.map((firstName) => ({ firstName })))
  .onConflictDoNothing()

console.log(`Seeded ${names.length} players`)
process.exit(0)