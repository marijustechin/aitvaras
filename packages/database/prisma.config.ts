import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 does not load `.env` automatically. Load the workspace root `.env`
// when DATABASE_URL is not already provided by the environment.
if (!process.env.DATABASE_URL) {
  for (const candidate of [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ]) {
    try {
      process.loadEnvFile(candidate);
      break;
    } catch {
      // File not present; fall back to the ambient environment (e.g. CI).
    }
  }
}

// `prisma generate` does not connect to a database. Provide a syntactically
// valid fallback so `generate`/`validate` work on a fresh clone without a local
// `.env`; commands that connect (migrate, db pull, ...) require a real URL.
process.env.DATABASE_URL ??=
  "postgresql://aitvaras:aitvaras@127.0.0.1:5432/aitvaras?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
