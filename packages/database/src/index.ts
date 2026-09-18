import { PrismaPg } from "@prisma/adapter-pg";

// Re-export the Prisma 7 generated client (PrismaClient, Prisma namespace and
// model types) so consumers depend on this package rather than the generated
// path.
export * from "./generated/prisma/client";

/**
 * Build the PostgreSQL driver adapter required by Prisma ORM 7.
 *
 * The connection string comes from the environment (DATABASE_URL); callers such
 * as the API's PrismaService must ensure `.env` is loaded first.
 */
export function createPrismaAdapter(
  connectionString: string | undefined = process.env.DATABASE_URL,
): PrismaPg {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create the Prisma adapter");
  }
  return new PrismaPg({ connectionString });
}
