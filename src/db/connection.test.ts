import { describe, expect, it } from "vitest";
import { connectionConfig } from "./connection";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";

describe("connectionConfig", () => {
  it("uses plain TCP for local databases", () => {
    const url = "postgres://postgres:postgres@127.0.0.1:5433/postgres";
    expect(connectionConfig(url, PEM)).toEqual({ connectionString: url, ssl: false });
    expect(connectionConfig("postgres://u:p@localhost/db", "").ssl).toBe(false);
  });

  it("verifies remote certificates against the default CAs", () => {
    expect(connectionConfig("postgres://u:p@ep-x-pooler.us-east-1.aws.neon.tech/db", "").ssl).toEqual({ rejectUnauthorized: true });
  });

  it("adds a custom root CA, accepting escaped newlines", () => {
    const ssl = connectionConfig("postgres://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres", PEM.replace(/\n/g, "\\n")).ssl;
    expect(ssl).toEqual({ rejectUnauthorized: true, ca: PEM });
  });

  it("drops URL ssl params that would override the ssl object", () => {
    const { connectionString } = connectionConfig("postgres://u:p@db.example.com/db?sslmode=require&application_name=x", "");
    expect(connectionString).toBe("postgres://u:p@db.example.com/db?application_name=x");
  });
});
