import { join } from "node:path";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient, createPrismaAdapter } from "@aitvaras/database";

/** Load the workspace root `.env` if DATABASE_URL is not already present. */
function loadEnvIfNeeded(): void {
  if (process.env.DATABASE_URL) {
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

/**
 * Nest-managed Prisma client (Prisma ORM 7, PostgreSQL driver adapter).
 *
 * The schema currently contains only the identity/access models
 * (User, Role, UserRole).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    loadEnvIfNeeded();
    super({ adapter: createPrismaAdapter() });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
