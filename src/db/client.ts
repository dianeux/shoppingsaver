import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { connectionConfig } from "./connection";
import * as schema from "./schema";

/**
 * One driver everywhere: node-postgres. Locally DATABASE_URL points at the
 * PGlite socket server (`npm run db`); in production at the hosted
 * Postgres pooler (see connection.ts for TLS).
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and run `npm run db`.");
  const config = connectionConfig(url);
  return new Pool({ ...config, max: config.ssl ? 5 : 4 });
}

export const pool = globalForDb.pool ?? makePool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
