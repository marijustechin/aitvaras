import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Resource, RoleKey } from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { LoginAttemptService } from "../src/modules/auth/login-attempt.service";
import { hashPassword } from "../src/modules/auth/password";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_resources_";
const UNKNOWN_UUID = "99999999-9999-4999-8999-999999999999";

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

  /** The three categories seeded by the managed-category migration. */
  async function seededCategoryId(name: string): Promise<string> {
    const category = await prisma.resourceCategory.findFirstOrThrow({
      where: { name },
    });
    return category.id;
  }

  async function createResource(
    name: string,
    categoryId: string,
    extra: Record<string, unknown> = {},
  ): Promise<Resource> {
    const res = await app.inject({
      method: "POST",
      url: "/resources",
      ...auth(adminCookie),
      payload: { name, categoryId, ...extra },
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
    const categoryId = await seededCategoryId("Žaliava");
    const resource = await createResource(`${PREFIX}readable`, categoryId);

    const list = await app.inject({
      method: "GET",
      url: "/resources",
      ...auth(workerCookie),
    });
    expect(list.statusCode).toBe(200);
    const found = (list.json() as Resource[]).find(
      (item) => item.id === resource.id,
    );
    expect(found?.categoryName).toBe("Žaliava");
    expect(found?.categoryActive).toBe(true);

    const detail = await app.inject({
      method: "GET",
      url: `/resources/${resource.id}`,
      ...auth(workerCookie),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().categoryId).toBe(categoryId);
  });

  it("forbids a non-admin from creating or updating", async () => {
    const categoryId = await seededCategoryId("Žaliava");
    const resource = await createResource(`${PREFIX}guarded`, categoryId);

    const create = await app.inject({
      method: "POST",
      url: "/resources",
      ...auth(workerCookie),
      payload: { name: `${PREFIX}nope`, categoryId },
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

  it("supports the seeded categories and defaults to active", async () => {
    for (const name of ["Žaliava", "Pusgaminis", "Gaminys"]) {
      const categoryId = await seededCategoryId(name);
      const resource = await createResource(`${PREFIX}cat-${name}`, categoryId);
      expect(resource.categoryId).toBe(categoryId);
      expect(resource.categoryName).toBe(name);
      expect(resource.active).toBe(true);
      expect(resource.notes).toBeNull();
    }
  });

  it("rejects unknown category, blank name, unknown fields and malformed ids", async () => {
    const categoryId = await seededCategoryId("Žaliava");
    for (const payload of [
      { name: `${PREFIX}badcat`, categoryId: UNKNOWN_UUID },
      { name: "   ", categoryId },
      { categoryId },
      { name: `${PREFIX}q`, categoryId, quantity: 5 },
      { name: `${PREFIX}id`, categoryId, id: UNKNOWN_UUID },
      { name: `${PREFIX}old`, category: "RAW_MATERIAL" },
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

  it("rejects creating a resource with an inactive category", async () => {
    const inactive = await prisma.resourceCategory.create({
      data: { name: `${PREFIX}inactive-cat`, active: false },
    });

    const res = await app.inject({
      method: "POST",
      url: "/resources",
      ...auth(adminCookie),
      payload: { name: `${PREFIX}with-inactive`, categoryId: inactive.id },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe("Pasirinkta kategorija neaktyvi.");
  });

  it("keeps a resource's inactive category on read and name-only edit", async () => {
    const category = await prisma.resourceCategory.create({
      data: { name: `${PREFIX}retired-cat`, active: true },
    });
    const resource = await createResource(`${PREFIX}historical`, category.id);

    await prisma.resourceCategory.update({
      where: { id: category.id },
      data: { active: false },
    });

    const detail = await app.inject({
      method: "GET",
      url: `/resources/${resource.id}`,
      ...auth(workerCookie),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().categoryId).toBe(category.id);
    expect(detail.json().categoryName).toBe(`${PREFIX}retired-cat`);
    expect(detail.json().categoryActive).toBe(false);

    // Editing other fields keeps the (now inactive) category.
    const renamed = await app.inject({
      method: "PATCH",
      url: `/resources/${resource.id}`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}historical-renamed` },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().categoryId).toBe(category.id);

    // Reassigning the inactive category to another resource is rejected.
    const other = await createResource(
      `${PREFIX}other`,
      await seededCategoryId("Žaliava"),
    );
    const reassign = await app.inject({
      method: "PATCH",
      url: `/resources/${other.id}`,
      ...auth(adminCookie),
      payload: { categoryId: category.id },
    });
    expect(reassign.statusCode).toBe(400);
    expect(reassign.json().message).toBe("Pasirinkta kategorija neaktyvi.");
  });

  it("lets an admin edit name, category and notes, and rejects empty updates", async () => {
    const resource = await createResource(
      `${PREFIX}edit`,
      await seededCategoryId("Žaliava"),
    );
    const finished = await seededCategoryId("Gaminys");

    const updated = await app.inject({
      method: "PATCH",
      url: `/resources/${resource.id}`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}edit-renamed`, categoryId: finished, notes: "  " },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().name).toBe(`${PREFIX}edit-renamed`);
    expect(updated.json().categoryId).toBe(finished);
    expect(updated.json().categoryName).toBe("Gaminys");
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
      payload: { unknownField: UNKNOWN_UUID },
    });
    expect(unknown.statusCode).toBe(400);
  });

  it("deactivates a resource without removing it", async () => {
    const resource = await createResource(
      `${PREFIX}inactive`,
      await seededCategoryId("Pusgaminis"),
    );

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
  });

  it("never mutates another resource on update", async () => {
    const first = await createResource(
      `${PREFIX}first`,
      await seededCategoryId("Žaliava"),
    );
    const second = await createResource(
      `${PREFIX}second`,
      await seededCategoryId("Gaminys"),
    );

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
    expect(untouched.categoryId).not.toBe(first.categoryId);
  });

  it("lists resources ordered by name ascending", async () => {
    const categoryId = await seededCategoryId("Žaliava");
    await createResource(`${PREFIX}ord-b`, categoryId);
    await createResource(`${PREFIX}ord-a`, categoryId);

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
