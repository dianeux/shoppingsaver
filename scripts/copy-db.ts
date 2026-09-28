/**
 * One-off: copy the indexed catalog from one Postgres to another (e.g. the
 * local PGlite server → Supabase) so production doesn't start empty or need a
 * multi-hour first crawl. The target must already be migrated.
 *
 *   SOURCE_DATABASE_URL=postgres://…local… TARGET_ENV_FILE=.env.production.local npm run db:copy
 *
 * The target URL (and DATABASE_CA_CERT, if the host needs one) is read from
 * TARGET_ENV_FILE so it never has to be typed on the command line. Existing
 * target rows are kept (ON CONFLICT DO NOTHING).
 */
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import { connectionConfig } from "../src/db/connection";

const TABLES = ["products", "price_snapshots", "price_drops", "crawl_runs"] as const; // FK order
const BATCH = 200;

function targetEnv() {
  const file = process.env.TARGET_ENV_FILE ?? ".env.production.local";
  const env = parse(readFileSync(file));
  if (!env.DATABASE_URL) throw new Error(`DATABASE_URL not found in ${file}`);
  return { url: env.DATABASE_URL, ca: env.DATABASE_CA_CERT };
}

const dest = targetEnv();
const source = new pg.Client(connectionConfig(process.env.SOURCE_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/postgres", undefined));
const target = new pg.Client(connectionConfig(dest.url, dest.ca));
await source.connect();
await target.connect();
console.log(`target host: ${new URL(dest.url).host}`);

for (const table of TABLES) {
  const cols = (
    await target.query<{ column_name: string; data_type: string }>(
      "select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position",
      [table],
    )
  ).rows;
  if (!cols.length) throw new Error(`${table} missing on target — run migrations first`);
  const names = cols.map((c) => `"${c.column_name}"`).join(", ");
  const { rows } = await source.query(`select ${names} from ${table}`);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const params: unknown[] = [];
    const tuples = chunk.map((row) =>
      `(${cols
        .map((c) => {
          const v = row[c.column_name];
          // node-postgres turns JS arrays into Postgres arrays; jsonb needs a JSON string.
          params.push(c.data_type === "jsonb" && v !== null ? JSON.stringify(v) : v);
          return `$${params.length}`;
        })
        .join(", ")})`,
    );
    const res = await target.query(`insert into ${table} (${names}) values ${tuples.join(", ")} on conflict do nothing`, params);
    inserted += res.rowCount ?? 0;
  }
  console.log(`${table}: ${rows.length} rows read, ${inserted} inserted`);
}

// crawl_runs.id is serial: continue the sequence after the copied ids.
await target.query("select setval(pg_get_serial_sequence('crawl_runs', 'id'), coalesce((select max(id) from crawl_runs), 1))");
await source.end();
await target.end();
