import { asc } from 'drizzle-orm'
import { db } from './db/index.js'
import { players } from './db/schema.js'
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle(pool, { schema })