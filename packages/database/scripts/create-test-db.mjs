// Create the dedicated test database on the existing local PostgreSQL server.
//
// Usage: `pnpm db:test:create` (idempotent).
// Safe by design: it never drops or alters the development database; it only
// ensures a separately named test database exists.
import { resolve } from "node:path";
import pg from "pg";

const TEST_DB = "aitvaras_test";
const { Client } = pg;

function loadEnv() {
  if (process.env.DATABASE_URL) {
    return;
  }
  for (const candidate of [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ]) {
    try {
      process.loadEnvFile(candidate);
      return;
    } catch {
      // Try the next candidate.
    }
  }
}

loadEnv();

const base = process.env.DATABASE_URL;
if (!base) {
  console.error(
    "DATABASE_URL is required to create the test database (see .env.example).",
  );
  process.exit(1);
}

let baseName;
try {
  baseName = new URL(base).pathname.replace(/^\//, "").split("?")[0];
} catch {
  baseName = undefined;
}

if (baseName === TEST_DB) {
  console.log(`DATABASE_URL already targets the test database "${TEST_DB}".`);
  process.exit(0);
}

// Connect to the always-present maintenance database on the same server.
const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";

const client = new Client({ connectionString: adminUrl.toString() });
try {
  await client.connect();
  const existing = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [TEST_DB],
  );
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE "${TEST_DB}"`);
    console.log(`Created test database "${TEST_DB}".`);
  } else {
    console.log(`Test database "${TEST_DB}" already exists.`);
  }
} catch (error) {
  console.error(
    `Failed to create test database "${TEST_DB}": ` +
      (error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
