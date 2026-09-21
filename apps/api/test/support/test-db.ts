import { createConnection } from "node:net";
import { join } from "node:path";

/**
 * Dedicated test database. Integration tests must target this database and
 * must never read from or mutate the development database.
 */
export const TEST_DATABASE_NAME = "aitvaras_test";

/** Load the workspace root `.env` so `TEST_DATABASE_URL` is available. */
export function loadTestEnv(): void {
  if (process.env.TEST_DATABASE_URL) {
    return;
  }
  for (const candidate of [
    join(process.cwd(), "../../.env"),
    join(process.cwd(), ".env"),
  ]) {
    try {
      process.loadEnvFile(candidate);
      return;
    } catch {
      // Try the next candidate.
    }
  }
}

/** Database name parsed from a PostgreSQL connection URL. */
export function databaseNameOf(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.replace(/^\//, "").split("?")[0];
    return name || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the explicit test database URL.
 *
 * Throws when `TEST_DATABASE_URL` is missing. Tests must never silently fall
 * back to the development `DATABASE_URL`.
 */
export function resolveTestDatabaseUrl(): string {
  loadTestEnv();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Integration tests must use a dedicated " +
        'test database (e.g. ".../aitvaras_test"), never the development ' +
        "database. Create it with `pnpm db:test:create` and set " +
        "TEST_DATABASE_URL (see .env.example).",
    );
  }
  return url;
}

/**
 * Safety guard: refuse to run destructive/test setup against anything other
 * than the expected test database. The connection target itself is checked;
 * `NODE_ENV` is not relied upon.
 */
export function assertTestDatabase(url: string): void {
  const name = databaseNameOf(url);
  if (name !== TEST_DATABASE_NAME) {
    throw new Error(
      `Refusing destructive test setup: database "${name ?? "unknown"}" is not ` +
        `the test database "${TEST_DATABASE_NAME}".`,
    );
  }
}

/**
 * Point the current process at the test database (asserting it first) so that
 * the Nest app's PrismaService and any direct PrismaClient use the test DB.
 * Returns the test URL.
 */
export function applyTestDatabaseEnv(): string {
  const url = resolveTestDatabaseUrl();
  assertTestDatabase(url);
  process.env.DATABASE_URL = url;
  return url;
}

function tcpReachable(url: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      const parsed = new URL(url);
      const port = Number(parsed.port || 5432);
      const socket = createConnection({ host: parsed.hostname, port });
      socket.setTimeout(1500);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", () => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

/**
 * Best-effort reachability check of the configured test database. Returns
 * false when it is missing or unreachable, so integration suites can skip
 * explicitly (they never fall back to the development database).
 */
export async function isTestDatabaseReachable(): Promise<boolean> {
  let url: string;
  try {
    url = resolveTestDatabaseUrl();
  } catch {
    return false;
  }
  return tcpReachable(url);
}
