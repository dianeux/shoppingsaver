import type { PoolConfig } from "pg";

/**
 * node-postgres connection settings for a DATABASE_URL.
 *
 * Remote databases always verify the server certificate. Neon's chains to a
 * public CA; Supabase signs with its own root, so its PEM goes in
 * DATABASE_CA_CERT (literal newlines or `\n` escapes both work).
 *
 * sslmode/sslrootcert are stripped from the URL because node-postgres lets the
 * URL's SSL settings override the `ssl` object below.
 */
export function connectionConfig(url: string, caCert = process.env.DATABASE_CA_CERT): Pick<PoolConfig, "connectionString" | "ssl"> {
  const parsed = new URL(url);
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(parsed.hostname)) return { connectionString: url, ssl: false };
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) parsed.searchParams.delete(key);
  const ca = caCert?.trim().replace(/\\n/g, "\n");
  return { connectionString: parsed.toString(), ssl: ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true } };
}
