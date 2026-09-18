import { join } from "node:path";
import { PrismaClient, createPrismaAdapter } from "@aitvaras/database";
import { ensureInitialRoles } from "../modules/access/role-catalog";
import { hashPassword } from "../modules/auth/password";

/**
 * Development-only seed account.
 *
 * The weak credentials are intentional and MUST NOT be used outside local
 * development. See `assertDevelopmentEnvironment` below.
 */
const DEV_USERNAME = "localdev";
const DEV_PASSWORD = "localdev";
const DEV_FIRST_NAME = "Local";
const DEV_LAST_NAME = "Developer";

interface SeedEnvironment {
  NODE_ENV?: string;
  DATABASE_URL?: string;
}

function isLocalDatabase(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

/**
 * Guard the development seed. It refuses to run unless the environment is
 * explicitly development AND the database is local. This is enforced in code,
 * not just documented.
 */
export function assertDevelopmentEnvironment(env: SeedEnvironment): void {
  if (env.NODE_ENV !== "development") {
    throw new Error(
      `Refusing to seed: NODE_ENV must be "development" (got "${env.NODE_ENV ?? "unset"}").`,
    );
  }
  if (!isLocalDatabase(env.DATABASE_URL)) {
    throw new Error(
      "Refusing to seed: DATABASE_URL must point at a local database (localhost/127.0.0.1/::1).",
    );
  }
}

/**
 * Idempotently ensure the local development admin account:
 * `localdev` / `localdev` (ADMIN, active). Safe to run repeatedly.
 */
export async function seedDevelopmentUser(
  prisma: PrismaClient,
  env: SeedEnvironment = process.env,
): Promise<void> {
  assertDevelopmentEnvironment(env);

  await ensureInitialRoles(prisma);

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { key: "ADMIN" },
  });
  const passwordHash = await hashPassword(DEV_PASSWORD);

  const user = await prisma.user.upsert({
    where: { username: DEV_USERNAME },
    update: {
      firstName: DEV_FIRST_NAME,
      lastName: DEV_LAST_NAME,
      active: true,
      passwordHash,
    },
    create: {
      username: DEV_USERNAME,
      firstName: DEV_FIRST_NAME,
      lastName: DEV_LAST_NAME,
      passwordHash,
      active: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });
}

// Load the workspace-level .env (the app does the same at runtime), but never
// let it override values explicitly provided by the environment.
const explicitNodeEnv = process.env.NODE_ENV;
const explicitDatabaseUrl = process.env.DATABASE_URL;
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
if (explicitNodeEnv !== undefined) {
  process.env.NODE_ENV = explicitNodeEnv;
}
if (explicitDatabaseUrl !== undefined) {
  process.env.DATABASE_URL = explicitDatabaseUrl;
}

async function main(): Promise<void> {
  assertDevelopmentEnvironment(process.env);

  const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
  try {
    await seedDevelopmentUser(prisma);
    console.log(
      `Development user ensured: ${DEV_USERNAME} (ADMIN, active). Local login only.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

/** True when this file is executed directly (not imported by a test). */
function isDirectExecution(): boolean {
  return (
    typeof require === "function" &&
    typeof module !== "undefined" &&
    require.main === module
  );
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
