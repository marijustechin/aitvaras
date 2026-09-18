import { execSync } from "node:child_process";
import { join } from "node:path";
import { isDatabaseReachable, loadWorkspaceEnv } from "./support/test-env";

/**
 * Apply committed Prisma migrations before the test run when PostgreSQL is
 * reachable. Integration tests skip themselves when it is not.
 */
export default async function globalSetup(): Promise<void> {
  loadWorkspaceEnv();

  if (!(await isDatabaseReachable())) {
    console.warn(
      "[tests] PostgreSQL is not reachable; database integration tests will be skipped.",
    );
    return;
  }

  execSync("pnpm --filter @aitvaras/database exec prisma migrate deploy", {
    cwd: join(process.cwd(), "../.."),
    stdio: "inherit",
    env: { ...process.env },
  });
}
