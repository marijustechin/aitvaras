import { PrismaClient, createPrismaAdapter } from "@aitvaras/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyPassword } from "../src/modules/auth/password";
import {
  assertDevelopmentEnvironment,
  seedDevelopmentUser,
} from "../src/scripts/seed-dev";
import { isDatabaseReachable } from "./support/test-env";

const dbAvailable = await isDatabaseReachable();
const DEV_USERNAME = "localdev";

describe("development seed environment guard", () => {
  it("refuses to run outside development", () => {
    expect(() =>
      assertDevelopmentEnvironment({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://x@127.0.0.1:5432/db",
      }),
    ).toThrow(/NODE_ENV must be "development"/);
  });

  it("refuses to run against a non-local database", () => {
    expect(() =>
      assertDevelopmentEnvironment({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://x@db.example.com:5432/prod",
      }),
    ).toThrow(/local database/);
  });

  it("allows a development environment with a local database", () => {
    expect(() =>
      assertDevelopmentEnvironment({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://x@127.0.0.1:5432/db",
      }),
    ).not.toThrow();
  });
});

describe.skipIf(!dbAvailable)("development seed (integration)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: createPrismaAdapter() });
    await prisma.user.deleteMany({ where: { username: DEV_USERNAME } });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { username: DEV_USERNAME } });
      await prisma.$disconnect();
    }
  });

  it("creates an idempotent, active ADMIN named Local Developer", async () => {
    const env = {
      NODE_ENV: "development",
      DATABASE_URL: process.env.DATABASE_URL,
    };

    await seedDevelopmentUser(prisma, env);
    await seedDevelopmentUser(prisma, env); // repeated run must not duplicate

    const matches = await prisma.user.findMany({
      where: { username: DEV_USERNAME },
      include: { roles: { include: { role: true } } },
    });
    expect(matches).toHaveLength(1);

    const user = matches[0]!;
    expect(user.firstName).toBe("Local");
    expect(user.lastName).toBe("Developer");
    expect(user.active).toBe(true);
    expect(user.roles.map((assignment) => assignment.role.key)).toEqual([
      "ADMIN",
    ]);
    await expect(verifyPassword(user.passwordHash, "localdev")).resolves.toBe(
      true,
    );
  });
});
