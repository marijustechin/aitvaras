import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { PackingForm, RoleKey } from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { hashPassword } from "../src/modules/auth/password";
import {
  CONFIRMED_PACKING_FORMS,
  ensureConfirmedPackingForms,
} from "../src/modules/packing-forms/packing-form-seed";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_packing_form_";
const UNKNOWN_UUID = "33333333-3333-4333-8333-333333333333";

describe.skipIf(!dbAvailable)("Packing forms (integration)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let workerCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

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

  async function cleanup(): Promise<void> {
    await prisma.packingForm.deleteMany({
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

  async function createForm(name: string): Promise<PackingForm> {
    const res = await app.inject({
      method: "POST",
      url: "/packing-forms",
      ...auth(adminCookie),
      payload: { name },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as PackingForm;
  }

  it("rejects unauthenticated access", async () => {
    expect(
      (await app.inject({ method: "GET", url: "/packing-forms" })).statusCode,
    ).toBe(401);
  });

  it("allows an authenticated non-admin to read", async () => {
    const form = await createForm(`${PREFIX}readable`);
    const list = await app.inject({
      method: "GET",
      url: "/packing-forms",
      ...auth(workerCookie),
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as PackingForm[]).map((item) => item.name)).toContain(
      form.name,
    );

    const detail = await app.inject({
      method: "GET",
      url: `/packing-forms/${form.id}`,
      ...auth(workerCookie),
    });
    expect(detail.statusCode).toBe(200);
  });

  it("forbids a non-admin from creating or updating", async () => {
    const form = await createForm(`${PREFIX}guarded`);

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/packing-forms",
          ...auth(workerCookie),
          payload: { name: `${PREFIX}nope` },
        })
      ).statusCode,
    ).toBe(403);

    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/packing-forms/${form.id}`,
          ...auth(workerCookie),
          payload: { name: `${PREFIX}renamed-by-worker` },
        })
      ).statusCode,
    ).toBe(403);
  });

  it("renames and deactivates, keeping the entry readable when inactive", async () => {
    const form = await createForm(`${PREFIX}lifecycle`);

    const renamed = await app.inject({
      method: "PATCH",
      url: `/packing-forms/${form.id}`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}lifecycle-renamed` },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().name).toBe(`${PREFIX}lifecycle-renamed`);

    const deactivated = await app.inject({
      method: "PATCH",
      url: `/packing-forms/${form.id}`,
      ...auth(adminCookie),
      payload: { active: false },
    });
    expect(deactivated.statusCode).toBe(200);
    expect(deactivated.json().active).toBe(false);

    const detail = await app.inject({
      method: "GET",
      url: `/packing-forms/${form.id}`,
      ...auth(workerCookie),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().active).toBe(false);
  });

  it("rejects blank names, unknown fields, duplicates and empty updates", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/packing-forms",
          ...auth(adminCookie),
          payload: { name: "   " },
        })
      ).statusCode,
    ).toBe(400);

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/packing-forms",
          ...auth(adminCookie),
          payload: { name: `${PREFIX}unknown`, capacity: 5 },
        })
      ).statusCode,
    ).toBe(400);

    const form = await createForm(`${PREFIX}duplicate`);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/packing-forms",
          ...auth(adminCookie),
          payload: { name: form.name },
        })
      ).statusCode,
    ).toBe(409);

    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/packing-forms/${form.id}`,
          ...auth(adminCookie),
          payload: {},
        })
      ).statusCode,
    ).toBe(400);

    expect(
      (
        await app.inject({
          method: "GET",
          url: `/packing-forms/${UNKNOWN_UUID}`,
          ...auth(adminCookie),
        })
      ).statusCode,
    ).toBe(404);

    expect(
      (
        await app.inject({
          method: "GET",
          url: "/packing-forms/not-a-uuid",
          ...auth(adminCookie),
        })
      ).statusCode,
    ).toBe(400);
  });

  it("seeds the confirmed packing forms idempotently", async () => {
    await ensureConfirmedPackingForms(prisma);
    await ensureConfirmedPackingForms(prisma);

    const found = await prisma.packingForm.findMany({
      where: { name: { in: [...CONFIRMED_PACKING_FORMS] } },
    });
    expect(found.map((form) => form.name).sort()).toEqual(
      [...CONFIRMED_PACKING_FORMS].sort(),
    );

    for (const name of CONFIRMED_PACKING_FORMS) {
      expect(await prisma.packingForm.count({ where: { name } })).toBe(1);
    }
  });
});
