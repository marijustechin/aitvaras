import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Resource, ResourceCategoryKey, RoleKey } from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { LoginAttemptService } from "../src/modules/auth/login-attempt.service";
import { hashPassword } from "../src/modules/auth/password";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_resources_";
const UNKNOWN_UUID = "22222222-2222-4222-8222-222222222222";
const CATEGORIES: ResourceCategoryKey[] = [
  "RAW_MATERIAL",
  "SEMI_FINISHED",
  "FINISHED_PRODUCT",
];

describe.skipIf(!dbAvailable)("Resources (integration)", () => {
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
    await prisma.resource.deleteMany({ where: { name: { startsWith: PREFIX } } });
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

  async function createResource(
    name: string,
    category: ResourceCategoryKey,
    extra: Record<string, unknown> = {},
  ): Promise<Resource> {
    const res = await app.inject({
      method: "POST",
      url: "/resources",
      ...auth(adminCookie),
      payload: { name, category, ...extra },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as Resource;
  }

  it("rejects unauthenticated access", async () => {
    expect((await app.inject({ method: "GET", url: "/resources" })).statusCode).toBe(
      401,
    );
  });

  it("allows an authenticated non-admin to list and read resources", async () => {
    const resource = await createResource(`${PREFIX}readable`, "RAW_MATERIAL");

    const list = await app.inject({
      method: "GET",
      url: "/resources",
      ...auth(workerCookie),
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as Resource[]).map((item) => item.name)).toContain(
      `${PREFIX}readable`,
    );

    const detail = await app.inject({
      method: "GET",
      url: `/resources/${resource.id}`,
      ...auth(workerCookie),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().id).toBe(resource.id);
  });

  it("forbids a non-admin from creating or updating", async () => {
    const resource = await createResource(`${PREFIX}guarded`, "RAW_MATERIAL");

    const create = await app.inject({
      method: "POST",
      url: "/resources",
      ...auth(workerCookie),
      payload: { name: `${PREFIX}nope`, category: "RAW_MATERIAL" },
    });
    expect(create.statusCode).toBe(403);

    const update = await app.inject({
      method: "PATCH",
      url: `/resources/${resource.id}`,
      ...auth(workerCookie),
      payload: { name: `${PREFIX}renamed-by-worker` },
    });
    expect(update.statusCode).toBe(403);
  });

  it("supports every confirmed category and defaults to active", async () => {
    for (const category of CATEGORIES) {
      const resource = await createResource(`${PREFIX}cat-${category}`, category);
      expect(resource.category).toBe(category);
      expect(resource.active).toBe(true);
      expect(resource.notes).toBeNull();
    }
  });

  it("rejects invalid category, blank name, unknown fields and malformed ids", async () => {
    for (const payload of [
      { name: `${PREFIX}badcat`, category: "NOPE" },
      { name: "   ", category: "RAW_MATERIAL" },
      { category: "RAW_MATERIAL" },
      { name: `${PREFIX}q`, category: "RAW_MATERIAL", quantity: 5 },
      { name: `${PREFIX}id`, category: "RAW_MATERIAL", id: UNKNOWN_UUID },
    ]) {
      const res = await app.inject({
        method: "POST",
        url: "/resources",
        ...auth(adminCookie),
        payload,
      });
      expect(res.statusCode).toBe(400);
    }

    expect(
      (
        await app.inject({
          method: "GET",
          url: "/resources/not-a-uuid",
          ...auth(adminCookie),
        })
      ).statusCode,
    ).toBe(400);

    expect(
      (
        await app.inject({
          method: "GET",
          url: `/resources/${UNKNOWN_UUID}`,
          ...auth(adminCookie),
        })
      ).statusCode,
    ).toBe(404);
  });

  it("lets an admin edit name, category and notes, and rejects empty updates", async () => {
    const resource = await createResource(`${PREFIX}edit`, "RAW_MATERIAL");

    const updated = await app.inject({
      method: "PATCH",
      url: `/resources/${resource.id}`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}edit-renamed`, category: "FINISHED_PRODUCT", notes: "  " },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().name).toBe(`${PREFIX}edit-renamed`);
    expect(updated.json().category).toBe("FINISHED_PRODUCT");
    expect(updated.json().notes).toBeNull();

    const empty = await app.inject({
      method: "PATCH",
      url: `/resources/${resource.id}`,
      ...auth(adminCookie),
      payload: {},
    });
    expect(empty.statusCode).toBe(400);

    const unknown = await app.inject({
      method: "PATCH",
      url: `/resources/${resource.id}`,
      ...auth(adminCookie),
      payload: { packingFormId: UNKNOWN_UUID },
    });
    expect(unknown.statusCode).toBe(400);
  });

  it("deactivates a resource without removing it", async () => {
    const resource = await createResource(`${PREFIX}inactive`, "SEMI_FINISHED");

    const deactivated = await app.inject({
      method: "PATCH",
      url: `/resources/${resource.id}`,
      ...auth(adminCookie),
      payload: { active: false },
    });
    expect(deactivated.statusCode).toBe(200);
    expect(deactivated.json().active).toBe(false);

    const detail = await app.inject({
      method: "GET",
      url: `/resources/${resource.id}`,
      ...auth(workerCookie),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().active).toBe(false);

    const list = await app.inject({
      method: "GET",
      url: "/resources",
      ...auth(workerCookie),
    });
    const found = (list.json() as Resource[]).find(
      (item) => item.id === resource.id,
    );
    expect(found?.active).toBe(false);
  });

  it("never mutates another resource on update", async () => {
    const first = await createResource(`${PREFIX}first`, "RAW_MATERIAL");
    const second = await createResource(`${PREFIX}second`, "FINISHED_PRODUCT");

    const res = await app.inject({
      method: "PATCH",
      url: `/resources/${first.id}`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}first-changed` },
    });
    expect(res.statusCode).toBe(200);

    const untouched = await prisma.resource.findUniqueOrThrow({
      where: { id: second.id },
    });
    expect(untouched.name).toBe(`${PREFIX}second`);
    expect(untouched.category).toBe("FINISHED_PRODUCT");
  });

  it("lists resources ordered by name ascending", async () => {
    await createResource(`${PREFIX}ord-b`, "RAW_MATERIAL");
    await createResource(`${PREFIX}ord-a`, "RAW_MATERIAL");

    const res = await app.inject({
      method: "GET",
      url: "/resources",
      ...auth(workerCookie),
    });
    const names = (res.json() as Resource[])
      .map((item) => item.name)
      .filter((name) => name.startsWith(`${PREFIX}ord-`));
    expect(names).toEqual([`${PREFIX}ord-a`, `${PREFIX}ord-b`]);
  });
});
