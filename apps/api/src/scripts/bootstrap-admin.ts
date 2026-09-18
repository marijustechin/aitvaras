import { join } from "node:path";
import { PrismaClient, createPrismaAdapter } from "@aitvaras/database";
import { hashPassword } from "../modules/auth/password";
import { ensureInitialRoles } from "../modules/access/role-catalog";

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
 * Safe initial-admin bootstrap.
 *
 * Reads credentials from the environment (never defaults, never committed),
 * ensures the initial roles exist, and creates a single ADMIN user. It is
 * idempotent: if the username already exists it makes no changes. It is NOT
 * run automatically at startup.
 */
async function main(): Promise<void> {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
  const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim();
  const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!username || !firstName || !lastName || !password) {
    throw new Error(
      "BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_FIRST_NAME, BOOTSTRAP_ADMIN_LAST_NAME and BOOTSTRAP_ADMIN_PASSWORD must be set (see .env.example)",
    );
  }
  if (password.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters");
  }

  const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
  try {
    await ensureInitialRoles(prisma);

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      console.log(`Admin bootstrap skipped: user "${username}" already exists.`);
      return;
    }

    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { key: "ADMIN" },
    });
    const passwordHash = await hashPassword(password);

    await prisma.user.create({
      data: {
        username,
        firstName,
        lastName,
        passwordHash,
        active: true,
        roles: { create: [{ roleId: adminRole.id }] },
      },
    });
    console.log(`Created admin user "${username}" with role ADMIN.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
