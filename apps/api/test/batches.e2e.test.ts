import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Bag, Batch, BatchDetail, RoleKey } from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { hashPassword } from "../src/modules/auth/password";
import { ean13CheckDigit } from "../src/modules/batches/bag-barcode";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_batches_";
const MISSING_UUID = "99999999-9999-4999-8999-999999999999";
const ARRIVAL = "2026-09-29T00:00:00.000Z";

function isEan13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) {
    return false;
  }
  return Number(barcode[12]) === ean13CheckDigit(barcode.slice(0, 12));
}

describe.skipIf(!dbAvailable)("Batches and bags (integration)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let cookie: string;
  let accountingCookie: string;

  let supplierId: string;
  let buyerOnlyId: string;
  let inactiveSupplierId: string;
  let activeResourceId: string;
  let inactiveResourceId: string;

  let warehouseAId: string;
  let warehouseBId: string;
  let inactiveWarehouseId: string;
  let locationA1Id: string;
  let locationB1Id: string;
  let inactiveLocationId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await cleanup();
    await seedUser("worker", "worker-password-123", ["WAREHOUSE_WORKER"]);
    await seedUser("accounting", "accounting-password-123", ["ACCOUNTING"]);
    cookie = await login(`${PREFIX}worker`, "worker-password-123");
    accountingCookie = await login(
      `${PREFIX}accounting`,
      "accounting-password-123",
    );

    supplierId = await seedPartner("supplier", ["SUPPLIER"]);
    buyerOnlyId = await seedPartner("buyer", ["BUYER"]);
    inactiveSupplierId = await seedPartner("inactive-supplier", ["SUPPLIER"], false);

    activeResourceId = await seedResource("active", true);
    inactiveResourceId = await seedResource("inactive", false);

    warehouseAId = await seedWarehouse("warehouse-a", true);
    warehouseBId = await seedWarehouse("warehouse-b", true);
    inactiveWarehouseId = await seedWarehouse("inactive-warehouse", false);
    locationA1Id = await seedLocation(warehouseAId, "a1", true);
    locationB1Id = await seedLocation(warehouseBId, "b1", true);
    inactiveLocationId = await seedLocation(warehouseAId, "inactive", false);
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
    await prisma.bag.deleteMany({
      where: { batch: { resource: { name: { startsWith: PREFIX } } } },
    });
    await prisma.batch.deleteMany({
      where: { resource: { name: { startsWith: PREFIX } } },
    });
    await prisma.warehouseLocation.deleteMany({
      where: { warehouse: { name: { startsWith: PREFIX } } },
    });
    await prisma.warehouse.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.businessPartner.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    await prisma.resource.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
  }

  async function seedUser(
    suffix: string,
    password: string,
    roles: RoleKey[],
  ): Promise<void> {
    const roleRecords = await prisma.role.findMany({ where: { key: { in: roles } } });
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

  async function seedPartner(
    suffix: string,
    roles: ("SUPPLIER" | "BUYER")[],
    active = true,
  ): Promise<string> {
    const partner = await prisma.businessPartner.create({
      data: {
        name: `${PREFIX}${suffix}`,
        active,
        roles: { create: roles.map((role) => ({ role })) },
      },
    });
    return partner.id;
  }

  async function seedResource(suffix: string, active: boolean): Promise<string> {
    const category = await prisma.resourceCategory.findFirstOrThrow({
      where: { name: "Žaliava" },
    });
    const resource = await prisma.resource.create({
      data: { name: `${PREFIX}${suffix}`, categoryId: category.id, active },
    });
    return resource.id;
  }

  async function seedWarehouse(suffix: string, active: boolean): Promise<string> {
    const warehouse = await prisma.warehouse.create({
      data: { name: `${PREFIX}${suffix}`, active },
    });
    return warehouse.id;
  }

  async function seedLocation(
    warehouseId: string,
    suffix: string,
    active: boolean,
  ): Promise<string> {
    const location = await prisma.warehouseLocation.create({
      data: { warehouseId, name: `${PREFIX}${suffix}`, active },
    });
    return location.id;
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

  function auth(): { cookies: Record<string, string> } {
    return { cookies: { [AUTH_COOKIE_NAME]: cookie } };
  }

  function batchPayload(overrides: Record<string, unknown> = {}) {
    return {
      resourceId: activeResourceId,
      supplierId,
      warehouseId: warehouseAId,
      arrivalDate: ARRIVAL,
      ...overrides,
    };
  }

  async function createBatch(
    payload: Record<string, unknown>,
  ): Promise<{ statusCode: number; body: unknown }> {
    const res = await app.inject({
      method: "POST",
      url: "/batches",
      ...auth(),
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() };
  }

  async function createBatchOk(overrides: Record<string, unknown> = {}): Promise<Batch> {
    const { statusCode, body } = await createBatch(batchPayload(overrides));
    expect(statusCode).toBe(201);
    return body as Batch;
  }

  async function addBag(
    batchId: string,
    payload: Record<string, unknown>,
  ): Promise<{ statusCode: number; body: unknown }> {
    const res = await app.inject({
      method: "POST",
      url: `/batches/${batchId}/bags`,
      ...auth(),
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() };
  }

  it("rejects unauthenticated requests", async () => {
    expect((await app.inject({ method: "GET", url: "/batches" })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/batches",
          payload: batchPayload(),
        })
      ).statusCode,
    ).toBe(401);
  });

  it("forbids non-warehouse roles from creating a batch", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/batches",
      cookies: { [AUTH_COOKIE_NAME]: accountingCookie },
      payload: batchPayload(),
    });
    expect(res.statusCode).toBe(403);
  });

  it("creates a pending batch with a generated code and zero totals", async () => {
    const batch = await createBatchOk();
    expect(batch.code).toMatch(/^P-\d{4}-\d{6}$/);
    expect(batch.status).toBe("PENDING");
    expect(batch.bagCount).toBe(0);
    expect(batch.totalWeight).toBe("0");
    expect(batch.resourceName).toBe(`${PREFIX}active`);
    expect(batch.supplierName).toBe(`${PREFIX}supplier`);
    expect(batch.warehouseName).toBe(`${PREFIX}warehouse-a`);
    expect(batch.createdByName).toBe("Seed worker");
  });

  it("generates unique, valid EAN-13 barcodes and derives totals", async () => {
    const batch = await createBatchOk();
    const first = await addBag(batch.id, { weight: "12.5" });
    expect(first.statusCode).toBe(201);
    const bagOne = first.body as Bag;
    expect(isEan13(bagOne.barcode)).toBe(true);
    expect(bagOne.batchCode).toBe(batch.code);
    expect(bagOne.weight).toBe("12.5");
    expect(bagOne.warehouseLocationId).toBeNull();

    const second = await addBag(batch.id, {
      weight: "7.25",
      warehouseLocationId: locationA1Id,
    });
    expect(second.statusCode).toBe(201);
    const bagTwo = second.body as Bag;
    expect(bagTwo.barcode).not.toBe(bagOne.barcode);
    expect(bagTwo.warehouseLocationName).toBe(`${PREFIX}a1`);

    const detail = await app.inject({
      method: "GET",
      url: `/batches/${batch.id}`,
      ...auth(),
    });
    expect(detail.statusCode).toBe(200);
    const body = detail.json() as BatchDetail;
    expect(body.bagCount).toBe(2);
    expect(body.totalWeight).toBe("19.75");
    expect(body.bags).toHaveLength(2);
  });

  it("looks up a bag by barcode and 404s for unknown codes", async () => {
    const batch = await createBatchOk();
    const created = await addBag(batch.id, { weight: "3" });
    const bag = created.body as Bag;

    const found = await app.inject({
      method: "GET",
      url: `/bags/by-barcode/${bag.barcode}`,
      ...auth(),
    });
    expect(found.statusCode).toBe(200);
    expect((found.json() as Bag).id).toBe(bag.id);

    const missing = await app.inject({
      method: "GET",
      url: "/bags/by-barcode/0000000000000",
      ...auth(),
    });
    expect(missing.statusCode).toBe(404);
  });

  it("rejects a bag location that does not belong to the batch warehouse", async () => {
    const batch = await createBatchOk();
    expect((await addBag(batch.id, { weight: "1", warehouseLocationId: locationB1Id })).statusCode).toBe(400);
    expect((await addBag(batch.id, { weight: "1", warehouseLocationId: inactiveLocationId })).statusCode).toBe(400);
    expect((await addBag(batch.id, { weight: "1", warehouseLocationId: MISSING_UUID })).statusCode).toBe(400);
  });

  it("refuses new bags once a batch is no longer pending", async () => {
    const batch = await createBatchOk();
    await prisma.batch.update({
      where: { id: batch.id },
      data: { status: "CONFIRMED" },
    });
    const result = await addBag(batch.id, { weight: "5" });
    expect(result.statusCode).toBe(400);
    expect((result.body as { message: string }).message).toContain("laukiančią");
  });

  it("rejects ineligible resource, supplier and warehouse", async () => {
    for (const payload of [
      batchPayload({ resourceId: inactiveResourceId }),
      batchPayload({ resourceId: MISSING_UUID }),
      batchPayload({ supplierId: buyerOnlyId }),
      batchPayload({ supplierId: inactiveSupplierId }),
      batchPayload({ supplierId: MISSING_UUID }),
      batchPayload({ warehouseId: inactiveWarehouseId }),
      batchPayload({ warehouseId: MISSING_UUID }),
    ]) {
      expect((await createBatch(payload)).statusCode, JSON.stringify(payload)).toBe(400);
    }
  });

  it("rejects invalid batch payloads", async () => {
    const cases: Record<string, unknown>[] = [
      batchPayload({ resourceId: undefined }),
      batchPayload({ resourceId: "not-a-uuid" }),
      batchPayload({ arrivalDate: "2026-09-29" }),
      batchPayload({ status: "CONFIRMED" }),
    ];
    for (const payload of cases) {
      expect((await createBatch(payload)).statusCode, JSON.stringify(payload)).toBe(400);
    }
  });

  it("rejects invalid bag payloads", async () => {
    const batch = await createBatchOk();
    for (const weight of ["0", "-1", "abc", ""]) {
      const result = await addBag(batch.id, { weight });
      expect(result.statusCode, weight).toBe(400);
    }
    expect((await addBag(batch.id, { weight: "1", barcode: "123" })).statusCode).toBe(400);
    expect((await addBag(batch.id, { weight: "1", warehouseLocationId: "nope" })).statusCode).toBe(400);
  });

  it("filters the list by status and rejects an unknown status", async () => {
    const pending = await app.inject({
      method: "GET",
      url: "/batches?status=PENDING",
      ...auth(),
    });
    expect(pending.statusCode).toBe(200);
    expect(
      (pending.json() as Batch[]).every((batch) => batch.status === "PENDING"),
    ).toBe(true);

    expect(
      (await app.inject({ method: "GET", url: "/batches?status=NOPE", ...auth() }))
        .statusCode,
    ).toBe(400);
  });

  it("returns 404/400 for bad batch ids", async () => {
    expect(
      (
        await app.inject({ method: "GET", url: `/batches/${MISSING_UUID}`, ...auth() })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: "GET", url: "/batches/not-a-uuid", ...auth() }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/batches/${MISSING_UUID}/bags`,
          ...auth(),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await addBag(MISSING_UUID, { weight: "1" })).statusCode,
    ).toBe(404);
  });
});
