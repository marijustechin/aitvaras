import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type {
  RoleKey,
  WarehouseLocation,
  WarehouseWithLocations,
} from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { hashPassword } from "../src/modules/auth/password";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_warehouses_";
const MISSING_UUID = "88888888-8888-4888-8888-888888888888";

describe.skipIf(!dbAvailable)("Warehouses (integration)", () => {
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
    await prisma.warehouseLocation.deleteMany({
      where: { warehouse: { name: { startsWith: PREFIX } } },
    });
    await prisma.warehouse.deleteMany({
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
    const value = res.cookies.find((c) => c.name === AUTH_COOKIE_NAME)?.value;
    if (!value) {
      throw new Error("login did not set an auth cookie");
    }
    return value;
  }

  function auth(cookie: string) {
    return { cookies: { [AUTH_COOKIE_NAME]: cookie } };
  }

  async function createWarehouse(
    suffix: string,
    cookie = adminCookie,
  ): Promise<WarehouseWithLocations> {
    const res = await app.inject({
      method: "POST",
      url: "/warehouses",
      ...auth(cookie),
      payload: { name: `${PREFIX}${suffix}` },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as WarehouseWithLocations;
  }

  async function createLocation(
    warehouseId: string,
    suffix: string,
  ): Promise<WarehouseLocation> {
    const res = await app.inject({
      method: "POST",
      url: `/warehouses/${warehouseId}/locations`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}${suffix}` },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as WarehouseLocation;
  }

  it("rejects unauthenticated access and non-admin writes", async () => {
    expect(
      (await app.inject({ method: "GET", url: "/warehouses" })).statusCode,
    ).toBe(401);

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/warehouses",
          ...auth(workerCookie),
          payload: { name: `${PREFIX}worker` },
        })
      ).statusCode,
    ).toBe(403);

    const warehouse = await createWarehouse("guarded");
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/warehouses/${warehouse.id}`,
          ...auth(workerCookie),
          payload: { name: "x" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/warehouses/${warehouse.id}/locations`,
          ...auth(workerCookie),
          payload: { name: "x" },
        })
      ).statusCode,
    ).toBe(403);
  });

  it("allows an authenticated non-admin to read warehouses", async () => {
    await createWarehouse("readable");
    const res = await app.inject({
      method: "GET",
      url: "/warehouses",
      ...auth(workerCookie),
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as WarehouseWithLocations[]).map((w) => w.name)).toContain(
      `${PREFIX}readable`,
    );
  });

  it("lets an admin create, rename and deactivate a warehouse", async () => {
    const created = await createWarehouse("lifecycle");
    expect(created.active).toBe(true);
    expect(created.locations).toEqual([]);

    const renamed = await app.inject({
      method: "PATCH",
      url: `/warehouses/${created.id}`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}lifecycle-renamed` },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().name).toBe(`${PREFIX}lifecycle-renamed`);

    const deactivated = await app.inject({
      method: "PATCH",
      url: `/warehouses/${created.id}`,
      ...auth(adminCookie),
      payload: { active: false },
    });
    expect(deactivated.statusCode).toBe(200);
    expect(deactivated.json().active).toBe(false);

    const detail = await app.inject({
      method: "GET",
      url: `/warehouses/${created.id}`,
      ...auth(workerCookie),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().active).toBe(false);
  });

  it("manages locations inside a warehouse", async () => {
    const warehouse = await createWarehouse("locations");
    const location = await createLocation(warehouse.id, "A1");
    expect(location.warehouseId).toBe(warehouse.id);

    const list = await app.inject({
      method: "GET",
      url: `/warehouses/${warehouse.id}/locations`,
      ...auth(workerCookie),
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as WarehouseLocation[]).map((l) => l.id)).toContain(
      location.id,
    );

    const renamed = await app.inject({
      method: "PATCH",
      url: `/warehouses/${warehouse.id}/locations/${location.id}`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}A1-renamed` },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().name).toBe(`${PREFIX}A1-renamed`);

    const deactivated = await app.inject({
      method: "PATCH",
      url: `/warehouses/${warehouse.id}/locations/${location.id}`,
      ...auth(adminCookie),
      payload: { active: false },
    });
    expect(deactivated.statusCode).toBe(200);
    expect(deactivated.json().active).toBe(false);
  });

  it("allows the same location name in different warehouses", async () => {
    const first = await createWarehouse("dup-a");
    const second = await createWarehouse("dup-b");
    await createLocation(first.id, "shared");
    const result = await app.inject({
      method: "POST",
      url: `/warehouses/${second.id}/locations`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}shared` },
    });
    expect(result.statusCode).toBe(201);
  });

  it("rejects a duplicate location name within the same warehouse with 409", async () => {
    const warehouse = await createWarehouse("dup-same");
    await createLocation(warehouse.id, "same");
    const duplicate = await app.inject({
      method: "POST",
      url: `/warehouses/${warehouse.id}/locations`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}same` },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it("keeps locations owned by one warehouse and validates the parent", async () => {
    const first = await createWarehouse("owner-a");
    const second = await createWarehouse("owner-b");
    const location = await createLocation(first.id, "owned");

    const wrongParent = await app.inject({
      method: "PATCH",
      url: `/warehouses/${second.id}/locations/${location.id}`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}nope` },
    });
    expect(wrongParent.statusCode).toBe(404);

    const missingParent = await app.inject({
      method: "POST",
      url: `/warehouses/${MISSING_UUID}/locations`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}orphan` },
    });
    expect(missingParent.statusCode).toBe(404);
  });

  it("rejects blank names, unknown fields and empty updates", async () => {
    const warehouse = await createWarehouse("validation");
    const cases: { url: string; method: "POST" | "PATCH"; payload: unknown }[] = [
      { url: "/warehouses", method: "POST", payload: { name: "  " } },
      { url: "/warehouses", method: "POST", payload: { name: "A", code: "X" } },
      { url: `/warehouses/${warehouse.id}`, method: "PATCH", payload: {} },
      {
        url: `/warehouses/${warehouse.id}/locations`,
        method: "POST",
        payload: { name: "" },
      },
    ];
    for (const item of cases) {
      const res = await app.inject({
        method: item.method,
        url: item.url,
        ...auth(adminCookie),
        payload: item.payload,
      });
      expect(res.statusCode, JSON.stringify(item)).toBe(400);
    }
  });
});
