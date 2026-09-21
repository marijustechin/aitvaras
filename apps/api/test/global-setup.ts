import { execSync } from "node:child_process";
import { join } from "node:path";
import {
  assertTestDatabase,
  isTestDatabaseReachable,
  resolveTestDatabaseUrl,
} from "./support/test-db";

/**
 * Prepare the dedicated test database before the run.
 *
 * - A missing `TEST_DATABASE_URL` or a non-test database is a hard error
 *   (integration tests must never fall back to the development database).
 * - When the test database is simply unreachable (e.g. no local Docker),
 *   integration tests skip explicitly; the run still fails loudly on
 *   misconfiguration above.
 */
export default async function globalSetup(): Promise<void> {
  const url = resolveTestDatabaseUrl();
  assertTestDatabase(url);

  if (!(await isTestDatabaseReachable())) {
    console.warn(
      "[tests] Test database is not reachable; database integration tests will be skipped.",
    );
    return;
  }

  execSync("pnpm --filter @aitvaras/database exec prisma migrate deploy", {
    cwd: join(process.cwd(), "../.."),
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
