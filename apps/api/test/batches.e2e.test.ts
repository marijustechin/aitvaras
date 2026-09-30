import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type {
  Bag,
  Batch,
  BatchDetail,
  BatchReconciliation,
  RoleKey,
} from "@aitvaras/contracts";
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
  let adminCookie: string;

  let supplierId: string;
  let buyerOnlyId: string;
  let inactiveSupplierId: string;
  let activeResourceId: string;
  let inactiveResourceId: string;

  let warehouseAId: string;
  let warehouseBId: string;
  let inactiveWarehouseId: string;
  let locationA1Id: string;
  let locationA2Id: string;
  let locationB1Id: string;
  let inactiveLocationId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await cleanup();
    await seedUser("worker", "worker-password-123", ["WAREHOUSE_WORKER"]);
    await seedUser("accounting", "accounting-password-123", ["ACCOUNTING"]);
    await seedUser("admin", "admin-password-123", ["ADMIN"]);
    cookie = await login(`${PREFIX}worker`, "worker-password-123");
    accountingCookie = await login(
      `${PREFIX}accounting`,
      "accounting-password-123",
    );
    adminCookie = await login(`${PREFIX}admin`, "admin-password-123");

    supplierId = await seedPartner("supplier", ["SUPPLIER"]);
    buyerOnlyId = await seedPartner("buyer", ["BUYER"]);
    inactiveSupplierId = await seedPartner("inactive-supplier", ["SUPPLIER"], false);

    activeResourceId = await seedResource("active", true);
    inactiveResourceId = await seedResource("inactive", false);

    warehouseAId = await seedWarehouse("warehouse-a", true);
    warehouseBId = await seedWarehouse("warehouse-b", true);
    inactiveWarehouseId = await seedWarehouse("inactive-warehouse", false);
    locationA1Id = await seedLocation(warehouseAId, "a1", true);
    locationA2Id = await seedLocation(warehouseAId, "a2", true);
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
    await prisma.bagCorrection.deleteMany({
      where: { bag: { batch: { resource: { name: { startsWith: PREFIX } } } } },
    });
    await prisma.bag.deleteMany({
      where: { batch: { resource: { name: { startsWith: PREFIX } } } },
    });
    await prisma.batch.deleteMany({
      where: { resource: { name: { startsWith: PREFIX } } },
    });
    await prisma.goodsReceipt.deleteMany({
      where: { partner: { name: { startsWith: PREFIX } } },
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

  function bagPayload(overrides: Record<string, unknown> = {}) {
    return {
      unit: "KG",
      quantity: "1",
      warehouseLocationId: locationA1Id,
      ...overrides,
    };
  }

  async function createBatchWithBags(quantities: string[]): Promise<Batch> {
    const batch = await createBatchOk();
    for (const quantity of quantities) {
      const result = await addBag(batch.id, bagPayload({ quantity }));
      expect(result.statusCode).toBe(201);
    }
    return batch;
  }

  async function seedReceiptLine(opts: {
    partnerId: string;
    resourceId: string;
    warehouseId: string;
    quantity: string;
    unitPrice?: string;
  }): Promise<{ receiptId: string; lineId: string }> {
    const receipt = await prisma.goodsReceipt.create({
      data: {
        partnerId: opts.partnerId,
        lines: {
          create: [
            {
              resourceId: opts.resourceId,
              quantity: opts.quantity,
              unit: "KG",
              unitPrice: opts.unitPrice ?? "1.5",
              warehouseId: opts.warehouseId,
            },
          ],
        },
      },
      include: { lines: true },
    });
    return { receiptId: receipt.id, lineId: receipt.lines[0]!.id };
  }

  async function reconcile(
    batchId: string,
    payload: Record<string, unknown>,
    asAdmin = true,
  ): Promise<{ statusCode: number; body: unknown }> {
    const res = await app.inject({
      method: "POST",
      url: `/batches/${batchId}/reconcile`,
      cookies: { [AUTH_COOKIE_NAME]: asAdmin ? adminCookie : cookie },
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() };
  }

  async function patchBag(
    batchId: string,
    bagId: string,
    payload: Record<string, unknown>,
    asAdmin = false,
  ): Promise<{ statusCode: number; body: unknown }> {
    const res = await app.inject({
      method: "PATCH",
      url: `/batches/${batchId}/bags/${bagId}`,
      cookies: { [AUTH_COOKIE_NAME]: asAdmin ? adminCookie : cookie },
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() };
  }

  async function voidBag(
    batchId: string,
    bagId: string,
    payload: Record<string, unknown> = {},
    asAdmin = false,
  ): Promise<{ statusCode: number; body: unknown }> {
    const res = await app.inject({
      method: "POST",
      url: `/batches/${batchId}/bags/${bagId}/void`,
      cookies: { [AUTH_COOKIE_NAME]: asAdmin ? adminCookie : cookie },
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() };
  }

  async function getDetail(batchId: string): Promise<BatchDetail> {
    const res = await app.inject({
      method: "GET",
      url: `/batches/${batchId}`,
      ...auth(),
    });
    expect(res.statusCode).toBe(200);
    return res.json() as BatchDetail;
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
    expect(batch.totalQuantity).toBe("0");
    expect(batch.resourceName).toBe(`${PREFIX}active`);
    expect(batch.supplierName).toBe(`${PREFIX}supplier`);
    expect(batch.warehouseName).toBe(`${PREFIX}warehouse-a`);
    expect(batch.createdByName).toBe("Seed worker");
  });

  it("generates unique, valid EAN-13 barcodes and derives totals", async () => {
    const batch = await createBatchOk();
    const first = await addBag(batch.id, bagPayload({ quantity: "12.5" }));
    expect(first.statusCode).toBe(201);
    const bagOne = first.body as Bag;
    expect(isEan13(bagOne.barcode)).toBe(true);
    expect(bagOne.batchCode).toBe(batch.code);
    expect(bagOne.quantity).toBe("12.5");
    expect(bagOne.unit).toBe("KG");
    expect(bagOne.warehouseLocationId).toBe(locationA1Id);

    const second = await addBag(
      batch.id,
      bagPayload({ quantity: "7.25", warehouseLocationId: locationA1Id }),
    );
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
    expect(body.totalQuantity).toBe("19.75");
    expect(body.unit).toBe("KG");
    expect(body.bags).toHaveLength(2);
    expect(body.suggestedLocationId).toBe(locationA1Id);
  });

  it("looks up a bag by barcode and 404s for unknown codes", async () => {
    const batch = await createBatchOk();
    const created = await addBag(batch.id, bagPayload({ quantity: "3" }));
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
    expect((await addBag(batch.id, bagPayload({ quantity: "1", warehouseLocationId: locationB1Id }))).statusCode).toBe(400);
    expect((await addBag(batch.id, bagPayload({ quantity: "1", warehouseLocationId: inactiveLocationId }))).statusCode).toBe(400);
    expect((await addBag(batch.id, bagPayload({ quantity: "1", warehouseLocationId: MISSING_UUID }))).statusCode).toBe(400);
    expect((await addBag(batch.id, bagPayload({ quantity: "1", warehouseLocationId: undefined }))).statusCode).toBe(400);
  });

  it("supports PCS handling units with whole quantities and derives totals", async () => {
    const batch = await createBatchOk();
    const first = await addBag(
      batch.id,
      bagPayload({ unit: "PCS", quantity: "12" }),
    );
    expect(first.statusCode).toBe(201);
    const bag = first.body as Bag;
    expect(bag.unit).toBe("PCS");
    expect(bag.quantity).toBe("12");

    const second = await addBag(
      batch.id,
      bagPayload({ unit: "PCS", quantity: "3" }),
    );
    expect(second.statusCode).toBe(201);

    const detail = await app.inject({
      method: "GET",
      url: `/batches/${batch.id}`,
      ...auth(),
    });
    const body = detail.json() as BatchDetail;
    expect(body.unit).toBe("PCS");
    expect(body.totalQuantity).toBe("15");
    expect(body.bagCount).toBe(2);
  });

  it("establishes one measurement unit per batch", async () => {
    const batch = await createBatchOk();
    const first = await addBag(
      batch.id,
      bagPayload({ unit: "PCS", quantity: "5" }),
    );
    expect(first.statusCode).toBe(201);

    const mismatch = await addBag(
      batch.id,
      bagPayload({ unit: "KG", quantity: "1.5" }),
    );
    expect(mismatch.statusCode).toBe(400);
    expect((mismatch.body as { code: string }).code).toBe("UNIT_MISMATCH");
  });

  it("exposes the resource category and last-used location on the detail", async () => {
    const batch = await createBatchOk();
    await addBag(batch.id, bagPayload({ quantity: "10" }));

    const detail = await app.inject({
      method: "GET",
      url: `/batches/${batch.id}`,
      ...auth(),
    });
    const body = detail.json() as BatchDetail;
    expect(body.resourceCategoryName).toBe("Žaliava");
    expect(body.unit).toBe("KG");
    expect(body.suggestedLocationId).toBe(locationA1Id);
    expect(body.bags[0]?.warehouseLocationId).toBe(locationA1Id);
    expect(body.bags[0]?.warehouseLocationName).toBe(`${PREFIX}a1`);
  });

  it("allows adding a bag to a pending or discrepant batch but not a confirmed one", async () => {
    const batch = await createBatchOk();
    await addBag(batch.id, bagPayload({ quantity: "1" }));
    await prisma.batch.update({
      where: { id: batch.id },
      data: { status: "DISCREPANCY" },
    });
    expect(
      (await addBag(batch.id, bagPayload({ quantity: "2" }))).statusCode,
    ).toBe(201);

    await prisma.batch.update({
      where: { id: batch.id },
      data: { status: "CONFIRMED" },
    });
    const result = await addBag(batch.id, bagPayload({ quantity: "1" }));
    expect(result.statusCode).toBe(400);
    expect((result.body as { code: string }).code).toBe("BATCH_CONFIRMED");
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
    for (const quantity of ["0", "-1", "abc", ""]) {
      const result = await addBag(batch.id, bagPayload({ quantity }));
      expect(result.statusCode, quantity).toBe(400);
    }
    // Fractional PCS is rejected (never silently rounded).
    expect(
      (await addBag(batch.id, bagPayload({ unit: "PCS", quantity: "3.5" })))
        .statusCode,
    ).toBe(400);
    expect(
      (await addBag(batch.id, bagPayload({ quantity: "1", barcode: "123" })))
        .statusCode,
    ).toBe(400);
    expect(
      (await addBag(batch.id, bagPayload({ quantity: "1", unit: "XYZ" }))).statusCode,
    ).toBe(400);
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
      (await addBag(MISSING_UUID, bagPayload({ quantity: "1" }))).statusCode,
    ).toBe(404);
  });

  it("confirms an exact-match batch and creates the internal receipt line", async () => {
    const batch = await createBatchWithBags(["12.5", "7.25"]);

    const result = await reconcile(batch.id, {
      documentWeight: "19.75",
      acquisitionAmount: "100",
    });
    expect(result.statusCode).toBe(200);
    const summary = result.body as BatchReconciliation;
    expect(summary.status).toBe("CONFIRMED");
    expect(summary.bagCount).toBe(2);
    expect(summary.measuredWeight).toBe("19.75");
    expect(summary.documentWeight).toBe("19.75");
    expect(summary.difference).toBe("0");
    expect(summary.receiptLineId).toBeTruthy();
    expect(summary.receiptId).toBeTruthy();
    expect(summary.confirmedAt).not.toBeNull();

    // The internal anchor was created from the batch context + formal data.
    const line = await prisma.goodsReceiptLine.findUniqueOrThrow({
      where: { id: summary.receiptLineId },
      include: { receipt: true, batch: true },
    });
    expect(line.resourceId).toBe(activeResourceId);
    expect(line.warehouseId).toBe(warehouseAId);
    expect(line.unit).toBe("KG");
    expect(line.quantity.toString()).toBe("19.75");
    expect(line.receipt.partnerId).toBe(supplierId);
    expect(line.batch?.id).toBe(batch.id);

    const detail = await app.inject({
      method: "GET",
      url: `/batches/${batch.id}`,
      ...auth(),
    });
    const body = detail.json() as BatchDetail;
    expect(body.status).toBe("CONFIRMED");
    expect(body.receiptLineId).toBe(summary.receiptLineId);
    expect(body.totalQuantity).toBe("19.75");
    expect(body.difference).toBe("0");
    expect(body.confirmedAt).not.toBeNull();
    // Arrival (physical) stays distinct from the confirmation time.
    expect(body.arrivalDate).toBe(ARRIVAL);
  });

  it("reuses an existing compatible, unlinked receipt line", async () => {
    const seeded = await seedReceiptLine({
      partnerId: supplierId,
      resourceId: activeResourceId,
      warehouseId: warehouseAId,
      quantity: "5",
    });
    const batch = await createBatchWithBags(["5"]);

    const result = await reconcile(batch.id, {
      documentWeight: "5",
      acquisitionAmount: "5",
    });
    expect(result.statusCode).toBe(200);
    const summary = result.body as BatchReconciliation;
    expect(summary.receiptLineId).toBe(seeded.lineId);
    expect(summary.receiptId).toBe(seeded.receiptId);
  });

  it("ignores an incompatible existing line and creates a new one", async () => {
    const incompatible = await seedReceiptLine({
      partnerId: supplierId,
      resourceId: inactiveResourceId,
      warehouseId: warehouseAId,
      quantity: "1",
    });
    const batch = await createBatchWithBags(["1"]);

    const result = await reconcile(batch.id, {
      documentWeight: "1",
      acquisitionAmount: "1",
    });
    const summary = result.body as BatchReconciliation;
    expect(summary.receiptLineId).toBeTruthy();
    expect(summary.receiptLineId).not.toBe(incompatible.lineId);
  });

  it("refuses weight reconciliation of a PCS batch", async () => {
    const batch = await createBatchOk();
    await addBag(batch.id, bagPayload({ unit: "PCS", quantity: "5" }));

    const result = await reconcile(batch.id, {
      documentWeight: "5",
      acquisitionAmount: "1",
    });
    expect(result.statusCode).toBe(400);
    expect((result.body as { code: string }).code).toBe("BATCH_NOT_WEIGHT");
  });

  it("derives the measured total from bags and flags a discrepancy", async () => {
    const batch = await createBatchWithBags(["10", "0.5", "2.25"]); // 12.75

    const result = await reconcile(batch.id, {
      documentWeight: "13",
      acquisitionAmount: "0",
    });
    expect(result.statusCode).toBe(200);
    const summary = result.body as BatchReconciliation;
    expect(summary.measuredWeight).toBe("12.75");
    expect(summary.difference).toBe("0.25");
    expect(summary.status).toBe("DISCREPANCY");
    expect(summary.confirmedAt).toBeNull();
    expect(Number(summary.acquisitionAmount)).toBe(0);
  });

  it("keeps the signed difference when the document weight is lower", async () => {
    const batch = await createBatchWithBags(["10.5"]);
    const result = await reconcile(batch.id, {
      documentWeight: "10",
      acquisitionAmount: "5",
    });
    expect((result.body as BatchReconciliation).difference).toBe("-0.5");
  });

  it("resolves a discrepancy by correcting the documentary weight without duplicating the receipt line", async () => {
    const batch = await createBatchWithBags(["4.5"]);

    const first = await reconcile(batch.id, {
      documentWeight: "5",
      acquisitionAmount: "10",
    });
    expect((first.body as BatchReconciliation).status).toBe("DISCREPANCY");
    const firstSummary = first.body as BatchReconciliation;
    const linesBefore = await prisma.goodsReceiptLine.count({
      where: { goodsReceiptId: firstSummary.receiptId },
    });

    const second = await reconcile(batch.id, {
      documentWeight: "4.5",
      acquisitionAmount: "9",
    });
    expect(second.statusCode).toBe(200);
    const summary = second.body as BatchReconciliation;
    expect(summary.status).toBe("CONFIRMED");
    expect(summary.difference).toBe("0");
    expect(summary.confirmedAt).not.toBeNull();
    // The retry reuses the same internal anchor — no duplicate receipt/line.
    expect(summary.receiptId).toBe(firstSummary.receiptId);
    expect(summary.receiptLineId).toBe(firstSummary.receiptLineId);
    expect(
      await prisma.goodsReceiptLine.count({
        where: { goodsReceiptId: firstSummary.receiptId },
      }),
    ).toBe(linesBefore);
  });

  it("creates no new bags and does not duplicate quantity", async () => {
    const batch = await createBatchWithBags(["3", "4"]);
    const before = await prisma.bag.count({ where: { batchId: batch.id } });

    await reconcile(batch.id, {
      documentWeight: "7",
      acquisitionAmount: "7",
    });
    expect(await prisma.bag.count({ where: { batchId: batch.id } })).toBe(before);

    const again = await reconcile(batch.id, {
      documentWeight: "7",
      acquisitionAmount: "7",
    });
    expect(again.statusCode).toBe(409);
    expect((again.body as { code: string }).code).toBe(
      "BATCH_ALREADY_CONFIRMED",
    );
    expect(await prisma.bag.count({ where: { batchId: batch.id } })).toBe(before);
  });

  it("rejects reconciling a batch with no bags", async () => {
    const batch = await createBatchOk();
    const result = await reconcile(batch.id, {
      documentWeight: "1",
      acquisitionAmount: "1",
    });
    expect(result.statusCode).toBe(400);
    expect((result.body as { code: string }).code).toBe("BATCH_EMPTY");
  });

  it("rejects an unknown batch and non-admin reconciliation", async () => {
    const batch = await createBatchWithBags(["1"]);

    expect(
      (
        await reconcile(MISSING_UUID, {
          documentWeight: "1",
          acquisitionAmount: "1",
        })
      ).statusCode,
    ).toBe(404);

    const asWorker = await reconcile(
      batch.id,
      { documentWeight: "1", acquisitionAmount: "1" },
      false,
    );
    expect(asWorker.statusCode).toBe(403);
  });

  it("rejects invalid reconciliation payloads", async () => {
    const batch = await createBatchWithBags(["1"]);
    const cases: Record<string, unknown>[] = [
      { documentWeight: "0", acquisitionAmount: "1" },
      { documentWeight: "-1", acquisitionAmount: "1" },
      { documentWeight: "1", acquisitionAmount: "-1" },
      { documentWeight: "1", acquisitionAmount: "1", measuredWeight: "1" },
      {
        documentWeight: "1",
        acquisitionAmount: "1",
        receiptLineId: MISSING_UUID,
      },
    ];
    for (const payload of cases) {
      expect(
        (await reconcile(batch.id, payload)).statusCode,
        JSON.stringify(payload),
      ).toBe(400);
    }
  });

  it("persists the acquisition value and formal document metadata", async () => {
    const batch = await createBatchWithBags(["6"]);

    const result = await reconcile(batch.id, {
      documentWeight: "6",
      acquisitionAmount: "123.45",
      documentDate: "2026-09-20T00:00:00.000Z",
      documentNumber: "SF-2026-001",
    });
    const summary = result.body as BatchReconciliation;
    expect(Number(summary.acquisitionAmount)).toBe(123.45);
    expect(summary.documentNumber).toBe("SF-2026-001");
    expect(summary.documentDate).toBe("2026-09-20T00:00:00.000Z");

    const detail = await app.inject({
      method: "GET",
      url: `/batches/${batch.id}`,
      ...auth(),
    });
    const body = detail.json() as BatchDetail;
    expect(Number(body.acquisitionAmount)).toBe(123.45);
    expect(body.documentNumber).toBe("SF-2026-001");
    expect(body.confirmedAt).not.toBeNull();
    expect(body.arrivalDate).toBe(ARRIVAL);
  });

  it("corrects a unit's quantity and location with an auditable trail", async () => {
    const batch = await createBatchOk();
    const created = (
      await addBag(batch.id, bagPayload({ quantity: "12.5" }))
    ).body as Bag;

    const quantity = await patchBag(batch.id, created.id, { quantity: "15" });
    expect(quantity.statusCode).toBe(200);
    expect((quantity.body as Bag).quantity).toBe("15");

    const location = await patchBag(batch.id, created.id, {
      warehouseLocationId: locationA2Id,
    });
    expect(location.statusCode).toBe(200);
    expect((location.body as Bag).warehouseLocationId).toBe(locationA2Id);

    const detail = await getDetail(batch.id);
    expect(detail.totalQuantity).toBe("15");
    expect(detail.bags[0]?.warehouseLocationId).toBe(locationA2Id);
    expect(detail.corrections).toHaveLength(2);
    expect(detail.corrections.map((c) => c.kind).sort()).toEqual([
      "LOCATION",
      "QUANTITY",
    ]);
    const q = detail.corrections.find((c) => c.kind === "QUANTITY");
    expect(q?.previousValue).toBe("12.5");
    expect(q?.newValue).toBe("15");
    expect(q?.createdByName).toBe("Seed worker");
    const loc = detail.corrections.find((c) => c.kind === "LOCATION");
    expect(loc?.previousValue).toBe(`${PREFIX}a1`);
    expect(loc?.newValue).toBe(`${PREFIX}a2`);
  });

  it("treats a no-op correction as unchanged and records no trail", async () => {
    const batch = await createBatchOk();
    const bag = (await addBag(batch.id, bagPayload({ quantity: "5" })))
      .body as Bag;

    const same = await patchBag(batch.id, bag.id, {
      quantity: "5",
      warehouseLocationId: bag.warehouseLocationId,
    });
    expect(same.statusCode).toBe(200);
    expect(
      await prisma.bagCorrection.count({ where: { bagId: bag.id } }),
    ).toBe(0);
  });

  it("voids a unit: preserved and excluded from the measured total", async () => {
    const batch = await createBatchOk();
    await addBag(batch.id, bagPayload({ quantity: "10" }));
    const second = (await addBag(batch.id, bagPayload({ quantity: "5" })))
      .body as Bag;

    const result = await voidBag(batch.id, second.id, {
      reason: "Sugedęs maišas",
    });
    expect(result.statusCode).toBe(200);
    const voided = result.body as Bag;
    expect(voided.status).toBe("VOIDED");
    expect(voided.voidReason).toBe("Sugedęs maišas");
    expect(voided.voidedByName).toBe("Seed worker");
    expect(voided.voidedAt).not.toBeNull();

    const detail = await getDetail(batch.id);
    expect(detail.bagCount).toBe(1);
    expect(detail.totalQuantity).toBe("10");
    expect(detail.bags).toHaveLength(2);
    expect(detail.bags.find((b) => b.id === second.id)?.status).toBe("VOIDED");
    const trail = detail.corrections.find((c) => c.kind === "VOID");
    expect(trail?.previousValue).toBe("5 KG");
    expect(trail?.reason).toBe("Sugedęs maišas");

    // The voided unit is excluded from reconciliation.
    const summary = (
      await reconcile(batch.id, {
        documentWeight: "10",
        acquisitionAmount: "10",
      })
    ).body as BatchReconciliation;
    expect(summary.bagCount).toBe(1);
    expect(summary.measuredWeight).toBe("10");
    expect(summary.status).toBe("CONFIRMED");
  });

  it("rejects correcting or voiding a voided unit or a confirmed batch", async () => {
    const batch = await createBatchOk();
    const bag = (await addBag(batch.id, bagPayload({ quantity: "5" })))
      .body as Bag;
    expect((await voidBag(batch.id, bag.id)).statusCode).toBe(200);

    const correctVoided = await patchBag(batch.id, bag.id, { quantity: "6" });
    expect(correctVoided.statusCode).toBe(400);
    expect((correctVoided.body as { code: string }).code).toBe("BAG_VOIDED");
    expect((await voidBag(batch.id, bag.id)).statusCode).toBe(400);

    const confirmedBatch = await createBatchOk();
    const confirmedBag = (
      await addBag(confirmedBatch.id, bagPayload({ quantity: "5" }))
    ).body as Bag;
    await prisma.batch.update({
      where: { id: confirmedBatch.id },
      data: { status: "CONFIRMED" },
    });
    const correctConfirmed = await patchBag(confirmedBatch.id, confirmedBag.id, {
      quantity: "6",
    });
    expect(correctConfirmed.statusCode).toBe(409);
    expect((correctConfirmed.body as { code: string }).code).toBe(
      "BATCH_CONFIRMED",
    );
    expect((await voidBag(confirmedBatch.id, confirmedBag.id)).statusCode).toBe(
      409,
    );
  });

  it("validates correction and void payloads", async () => {
    const batch = await createBatchOk();
    const bag = (await addBag(batch.id, bagPayload({ quantity: "5" })))
      .body as Bag;
    for (const payload of [
      {},
      { quantity: "0" },
      { quantity: "-1" },
      { warehouseLocationId: "not-a-uuid" },
      { warehouseLocationId: locationB1Id },
      { quantity: "5", status: "VOIDED" },
    ]) {
      expect(
        (await patchBag(batch.id, bag.id, payload)).statusCode,
        JSON.stringify(payload),
      ).toBe(400);
    }
    expect(
      (await voidBag(batch.id, bag.id, { reason: "x".repeat(501) })).statusCode,
    ).toBe(400);
  });

  it("rejects a fractional PCS correction", async () => {
    const batch = await createBatchOk();
    const bag = (
      await addBag(batch.id, bagPayload({ unit: "PCS", quantity: "5" }))
    ).body as Bag;
    const result = await patchBag(batch.id, bag.id, { quantity: "2.5" });
    expect(result.statusCode).toBe(400);
    expect((result.body as { code: string }).code).toBe("UNIT_MISMATCH");
    expect((await patchBag(batch.id, bag.id, { quantity: "7" })).statusCode).toBe(
      200,
    );
  });

  it("requires warehouse roles and valid ids for corrections", async () => {
    const batch = await createBatchOk();
    const bag = (await addBag(batch.id, bagPayload({ quantity: "5" })))
      .body as Bag;
    expect((await patchBag(batch.id, bag.id, { quantity: "6" })).statusCode).toBe(
      200,
    );

    const asAccounting = await app.inject({
      method: "PATCH",
      url: `/batches/${batch.id}/bags/${bag.id}`,
      cookies: { [AUTH_COOKIE_NAME]: accountingCookie },
      payload: { quantity: "7" },
    });
    expect(asAccounting.statusCode).toBe(403);
    const accountingVoid = await app.inject({
      method: "POST",
      url: `/batches/${batch.id}/bags/${bag.id}/void`,
      cookies: { [AUTH_COOKIE_NAME]: accountingCookie },
      payload: {},
    });
    expect(accountingVoid.statusCode).toBe(403);

    expect(
      (await patchBag(MISSING_UUID, bag.id, { quantity: "1" })).statusCode,
    ).toBe(404);
    expect(
      (await patchBag(batch.id, MISSING_UUID, { quantity: "1" })).statusCode,
    ).toBe(404);
    expect((await voidBag(MISSING_UUID, bag.id)).statusCode).toBe(404);
  });
});
