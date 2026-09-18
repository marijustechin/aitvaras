import { ROLE_CATALOG } from "@aitvaras/contracts";
import type { PrismaClient } from "@aitvaras/database";

/**
 * Idempotently ensure the initial role catalogue exists.
 *
 * Roles are configuration. This creates the four confirmed roles and keeps
 * their display names current; it never creates users.
 */
export async function ensureInitialRoles(prisma: PrismaClient): Promise<void> {
  for (const role of ROLE_CATALOG) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name },
      create: { key: role.key, name: role.name },
    });
  }
}
