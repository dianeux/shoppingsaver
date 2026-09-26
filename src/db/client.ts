import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * One driver everywhere: node-postgres. Locally DATABASE_URL points at the
 * PGlite socket server (`npm run db`); in production at Neon's pooled URL.
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and run `npm run db`.");
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  return new Pool({
    connectionString: url,
    max: isLocal ? 4 : 5,
    ssl: isLocal ? false : { rejectUnauthorized: true },
  });
}

export const pool = globalForDb.pool ?? makePool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
