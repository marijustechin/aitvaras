// Run Prisma migrate commands against the dedicated TEST database only.
//
// Usage: `pnpm db:test:migrate` (deploy) or `pnpm db:test:reset` (reset --force).
// Refuses to run unless TEST_DATABASE_URL targets the expected test database.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DB = "aitvaras_test";
const packageDir = resolve(fileURLToPath(import.meta.url), "../..");

function loadEnv() {
  if (process.env.TEST_DATABASE_URL) {
    return;
  }
  for (const candidate of [
    resolve(packageDir, ".env"),
    resolve(packageDir, "../../.env"),
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

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("TEST_DATABASE_URL is required (see .env.example).");
  process.exit(1);
}

let name;
try {
  name = new URL(url).pathname.replace(/^\//, "").split("?")[0];
} catch {
  name = undefined;
}
if (name !== TEST_DB) {
  console.error(
    `Refusing: TEST_DATABASE_URL must target "${TEST_DB}" (got "${name || "unknown"}").`,
  );
  process.exit(1);
}

const action = process.argv[2];
const args =
  action === "reset" ? ["migrate", "reset", "--force"] : ["migrate", "deploy"];

console.log(`[db:test] prisma ${args.join(" ")} -> ${TEST_DB}`);
const result = spawnSync("pnpm", ["exec", "prisma", ...args], {
  cwd: packageDir,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(result.status ?? 1);
