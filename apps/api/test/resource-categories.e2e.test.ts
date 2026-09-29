import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { ResourceCategory, RoleKey } from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { LoginAttemptService } from "../src/modules/auth/login-attempt.service";
import { hashPassword } from "../src/modules/auth/password";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_cats_";
const UNKNOWN_UUID = "99999999-9999-4999-8999-999999999999";

describe.skipIf(!dbAvailable)("Resource categories (integration)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let attempts: LoginAttemptService;
  let adminCookie: string;
  let workerCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    attempts = app.get(LoginAttemptService);

    await cleanup();
    await seedUser("admin", "admin-password-123", ["ADMIN"]);
    await seedUser("worker", "worker-password-123", ["WAREHOUSE_WORKER"]);
    adminCookie = await login(`${PREFIX}admin`, "admin-password-123");
    workerCookie = await login(`${PREFIX}worker`, "worker-password-123");
  });

  afterAll(async () => {
    if (prisma) {
      await cleanup();
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    attempts.clearAll();
  });

  async function cleanup(): Promise<void> {
    await prisma.resourceCategory.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
  }

  async function seedUser(
    suffix: string,
    password: string,
    roles: RoleKey[],
  ): Promise<void> {
    const roleRecords = await prisma.role.findMany({
      where: { key: { in: roles } },
    });
    await prisma.user.create({
      data: {
        username: `${PREFIX}${suffix}`,
        firstName: "Seed",
        lastName: suffix,
        passwordHash: await hashPassword(password),
        roles: { create: roleRecords.map((role) => ({ roleId: role.id })) },
      },
    });
  }

  async function login(username: string, password: string): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username, password },
    });
    const cookie = res.cookies.find((c) => c.name === AUTH_COOKIE_NAME)?.value;
    if (!cookie) {
      throw new Error("login did not set an auth cookie");
    }
    return cookie;
  }

  function auth(cookie: string) {
    return { cookies: { [AUTH_COOKIE_NAME]: cookie } };
  }

  async function createCategory(
    suffix: string,
    extra: Record<string, unknown> = {},
  ): Promise<ResourceCategory> {
    const res = await app.inject({
      method: "POST",
      url: "/resource-categories",
      ...auth(adminCookie),
      payload: { name: `${PREFIX}${suffix}`, ...extra },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as ResourceCategory;
  }

  it("rejects unauthenticated access", async () => {
    expect(
      (await app.inject({ method: "GET", url: "/resource-categories" }))
        .statusCode,
    ).toBe(401);
  });

  it("lists the three categories seeded by the migration", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/resource-categories",
      ...auth(workerCookie),
    });
    expect(res.statusCode).toBe(200);
    const names = (res.json() as ResourceCategory[]).map((item) => item.name);
    expect(names).toEqual(expect.arrayContaining(["Žaliava", "Pusgaminis", "Gaminys"]));
    const seeded = (res.json() as ResourceCategory[]).filter((item) =>
      ["Žaliava", "Pusgaminis", "Gaminys"].includes(item.name),
    );
    for (const category of seeded) {
      expect(category.active).toBe(true);
    }
  });

  it("lets an admin create a category and trims the name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/resource-categories",
      ...auth(adminCookie),
      payload: { name: `  ${PREFIX}Pakuotė  ` },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe(`${PREFIX}Pakuotė`);
    expect(res.json().active).toBe(true);
  });

  it("rejects a duplicate name with 409", async () => {
    await createCategory("dup", { name: `${PREFIX}dup` });
    const res = await app.inject({
      method: "POST",
      url: "/resource-categories",
      ...auth(adminCookie),
      payload: { name: `${PREFIX}dup` },
    });
    expect(res.statusCode).toBe(409);
  });

  it("lets an admin rename and deactivate/reactivate a category", async () => {
    const category = await createCategory("editable");

    const renamed = await app.inject({
      method: "PATCH",
      url: `/resource-categories/${category.id}`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}renamed` },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().name).toBe(`${PREFIX}renamed`);

    const off = await app.inject({
      method: "PATCH",
      url: `/resource-categories/${category.id}`,
      ...auth(adminCookie),
      payload: { active: false },
    });
    expect(off.statusCode).toBe(200);
    expect(off.json().active).toBe(false);

    const on = await app.inject({
      method: "PATCH",
      url: `/resource-categories/${category.id}`,
      ...auth(adminCookie),
      payload: { active: true },
    });
    expect(on.statusCode).toBe(200);
    expect(on.json().active).toBe(true);
  });

  it("rejects a non-admin mutation", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/resource-categories",
      ...auth(workerCookie),
      payload: { name: `${PREFIX}nope` },
    });
    expect(create.statusCode).toBe(403);

    const category = await createCategory("guarded");
    const update = await app.inject({
      method: "PATCH",
      url: `/resource-categories/${category.id}`,
      ...auth(workerCookie),
      payload: { name: `${PREFIX}nope2` },
    });
    expect(update.statusCode).toBe(403);
  });

  it("returns 404 for unknown ids and 400 for invalid payloads", async () => {
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/resource-categories/${UNKNOWN_UUID}`,
          ...auth(adminCookie),
        })
      ).statusCode,
    ).toBe(404);

    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/resource-categories/${UNKNOWN_UUID}`,
          ...auth(adminCookie),
          payload: { active: false },
        })
      ).statusCode,
    ).toBe(404);

    for (const payload of [
      { name: "   " },
      { name: `${PREFIX}x`, unknown: true },
      {},
    ]) {
      const res = await app.inject({
        method: "POST",
        url: "/resource-categories",
        ...auth(adminCookie),
        payload,
      });
      expect(res.statusCode).toBe(400);
    }
  });
});
