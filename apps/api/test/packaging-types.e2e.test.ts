import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { PackagingType, RoleKey } from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { hashPassword } from "../src/modules/auth/password";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_tara_";
const MISSING_UUID = "99999999-9999-4999-8999-999999999999";

describe.skipIf(!dbAvailable)("Packaging types (Tara) (integration)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let workerCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await prisma.packagingType.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    await seedUser("admin", ["ADMIN"]);
    await seedUser("worker", ["WAREHOUSE_WORKER"]);
    adminCookie = await login(`${PREFIX}admin`);
    workerCookie = await login(`${PREFIX}worker`);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.packagingType.deleteMany({
        where: { name: { startsWith: PREFIX } },
      });
      await prisma.user.deleteMany({
        where: { username: { startsWith: PREFIX } },
      });
    }
    if (app) {
      await app.close();
    }
  });

  async function seedUser(suffix: string, roles: RoleKey[]): Promise<void> {
    const roleRecords = await prisma.role.findMany({
      where: { key: { in: roles } },
    });
    await prisma.user.create({
      data: {
        username: `${PREFIX}${suffix}`,
        firstName: "Seed",
        lastName: suffix,
        passwordHash: await hashPassword("password-123456"),
        roles: { create: roleRecords.map((role) => ({ roleId: role.id })) },
      },
    });
  }

  async function login(username: string): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username, password: "password-123456" },
    });
    const value = res.cookies.find((c) => c.name === AUTH_COOKIE_NAME)?.value;
    if (!value) {
      throw new Error("login did not set an auth cookie");
    }
    return value;
  }

  function uniqueName(prefix: string): string {
    return `${PREFIX}${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  }

  async function createAs(
    cookieValue: string,
    payload: Record<string, unknown>,
  ): Promise<{ statusCode: number; body: unknown }> {
    const res = await app.inject({
      method: "POST",
      url: "/packaging-types",
      cookies: { [AUTH_COOKIE_NAME]: cookieValue },
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() };
  }

  it("requires authentication to list", async () => {
    expect(
      (
        await app.inject({ method: "GET", url: "/packaging-types" })
      ).statusCode,
    ).toBe(401);
  });

  it("allows any authenticated user to list", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/packaging-types",
      cookies: { [AUTH_COOKIE_NAME]: workerCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("forbids non-admin roles from creating or editing", async () => {
    const create = await createAs(workerCookie, {
      name: uniqueName("nope"),
      tareWeightKg: "1.000",
    });
    expect(create.statusCode).toBe(403);
  });

  it("creates a packaging type with a decimal tare weight string", async () => {
    const name = uniqueName("epal");
    const { statusCode, body } = await createAs(adminCookie, {
      name,
      tareWeightKg: "27.000",
    });
    expect(statusCode).toBe(201);
    const type = body as PackagingType;
    expect(type.name).toBe(name);
    expect(Number(type.tareWeightKg)).toBe(27);
    expect(type.active).toBe(true);
  });

  it("rejects a duplicate name", async () => {
    const name = uniqueName("dup");
    expect(
      (await createAs(adminCookie, { name, tareWeightKg: "1.000" })).statusCode,
    ).toBe(201);
    expect(
      (await createAs(adminCookie, { name, tareWeightKg: "2.000" })).statusCode,
    ).toBe(409);
  });

  it("rejects invalid create payloads", async () => {
    for (const payload of [
      { name: "", tareWeightKg: "1" },
      { name: uniqueName("x"), tareWeightKg: "-1" },
      { name: uniqueName("x"), tareWeightKg: "abc" },
      { name: uniqueName("x"), tareWeightKg: "1.2345" },
      { name: uniqueName("x"), tareWeightKg: "1", id: "x" },
    ]) {
      expect(
        (await createAs(adminCookie, payload)).statusCode,
        JSON.stringify(payload),
      ).toBe(400);
    }
  });

  it("edits name, tare weight and active state", async () => {
    const created = (
      await createAs(adminCookie, {
        name: uniqueName("edit"),
        tareWeightKg: "0.800",
      })
    ).body as PackagingType;

    const renamed = await app.inject({
      method: "PATCH",
      url: `/packaging-types/${created.id}`,
      cookies: { [AUTH_COOKIE_NAME]: adminCookie },
      payload: { name: uniqueName("renamed"), tareWeightKg: "0.900" },
    });
    expect(renamed.statusCode).toBe(200);
    expect(Number((renamed.json() as PackagingType).tareWeightKg)).toBe(0.9);

    const deactivated = await app.inject({
      method: "PATCH",
      url: `/packaging-types/${created.id}`,
      cookies: { [AUTH_COOKIE_NAME]: adminCookie },
      payload: { active: false },
    });
    expect(deactivated.statusCode).toBe(200);
    expect((deactivated.json() as PackagingType).active).toBe(false);
  });

  it("rejects an unknown id and an empty edit", async () => {
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/packaging-types/${MISSING_UUID}`,
          cookies: { [AUTH_COOKIE_NAME]: adminCookie },
          payload: { active: false },
        })
      ).statusCode,
    ).toBe(404);

    const created = (
      await createAs(adminCookie, {
        name: uniqueName("empty"),
        tareWeightKg: "1.000",
      })
    ).body as PackagingType;
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/packaging-types/${created.id}`,
          cookies: { [AUTH_COOKIE_NAME]: adminCookie },
          payload: {},
        })
      ).statusCode,
    ).toBe(400);
  });
});
