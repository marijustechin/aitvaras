import { join } from "node:path";
import { PrismaClient, createPrismaAdapter } from "@aitvaras/database";
import {
  CONFIRMED_PACKING_FORMS,
  ensureConfirmedPackingForms,
} from "../modules/packing-forms/packing-form-seed";

// Load the workspace-level .env (the app does the same at runtime).
for (const candidate of [
  join(process.cwd(), "../../.env"),
  join(process.cwd(), ".env"),
]) {
  try {
    process.loadEnvFile(candidate);
    break;
  } catch {
    // No local .env; rely on the ambient environment.
  }
}

/**
 * Explicit, idempotent reference/master-data seed.
 *
 * Ensures the confirmed packing forms exist. It is deliberately separate from
 * `seed:dev` (which owns the local development login) and is never run at
 * startup. Existing rows are never modified, so re-running is safe.
 *
 * Run with `pnpm seed:reference`.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
  try {
    const created = await ensureConfirmedPackingForms(prisma);
    console.log(
      `Reference data ensured: ${CONFIRMED_PACKING_FORMS.length} packing forms (${created} created).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
