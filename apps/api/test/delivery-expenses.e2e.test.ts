import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type {
  ApplyDeliveryExpensesResponse,
  BatchDetail,
  BatchPieceConfirmation,
  BatchReconciliation,
  DeliveryExpensePreview,
  DeliveryExpenses,
  IncomingDelivery,
  RoleKey,
  StockSummary,
} from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { hashPassword } from "../src/modules/auth/password";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_expenses_";
const ARRIVAL = "2026-11-16T00:00:00.000Z";

describe.skipIf(!dbAvailable)("Receipt expenses (integration)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let workerCookie: string;

  let supplierId: string;
  let resourceAId: string;
  let resourceBId: string;
  let warehouseId: string;
  let locationId: string;
  let packagingTypeId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await cleanup();
    await seedUser("admin", "admin-password-123", ["ADMIN"]);
    await seedUser("worker", "worker-password-123", ["WAREHOUSE_WORKER"]);
    adminCookie = await login(`${PREFIX}admin`, "admin-password-123");
    workerCookie = await login(`${PREFIX}worker`, "worker-password-123");

    const category = await prisma.resourceCategory.findFirstOrThrow({
      where: { name: "Žaliava" },
    });
    resourceAId = await seedResource("a", category.id);
    resourceBId = await seedResource("b", category.id);
    supplierId = await seedPartner();
    warehouseId = await seedWarehouse();
    locationId = await seedLocation();
    packagingTypeId = await seedPackagingType();
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
    const byDelivery = {
      delivery: { supplier: { name: { startsWith: PREFIX } } },
    } as const;
    await prisma.receivingDiscrepancy.deleteMany({
      where: { batch: byDelivery },
    });
    await prisma.pieceReconciliationLine.deleteMany({
      where: { batch: byDelivery },
    });
    await prisma.bagCorrection.deleteMany({
      where: { bag: { batch: byDelivery } },
    });
    await prisma.bag.deleteMany({ where: { batch: byDelivery } });
    await prisma.batchItem.deleteMany({ where: { batch: byDelivery } });
    await prisma.deliveryExpenseApplication.deleteMany({
      where: { delivery: { supplier: { name: { startsWith: PREFIX } } } },
    });
    await prisma.incomingDeliveryExpense.deleteMany({ where: byDelivery });
    await prisma.batch.deleteMany({ where: byDelivery });
    await prisma.incomingDelivery.deleteMany({
      where: { supplier: { name: { startsWith: PREFIX } } },
    });
    await prisma.goodsReceipt.deleteMany({
      where: { partner: { name: { startsWith: PREFIX } } },
    });
    await prisma.warehouseLocation.deleteMany({
      where: { warehouse: { name: { startsWith: PREFIX } } },
    });
    await prisma.warehouse.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    await prisma.businessPartner.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    await prisma.resource.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.packagingType.deleteMany({
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

  async function seedPartner(): Promise<string> {
    const partner = await prisma.businessPartner.create({
      data: {
        name: `${PREFIX}supplier`,
        roles: { create: [{ role: "SUPPLIER" }] },
      },
    });
    return partner.id;
  }

  async function seedResource(
    suffix: string,
    categoryId: string,
  ): Promise<string> {
    const resource = await prisma.resource.create({
      data: { name: `${PREFIX}${suffix}`, categoryId },
    });
    return resource.id;
  }

  async function seedWarehouse(): Promise<string> {
    const warehouse = await prisma.warehouse.create({
      data: { name: `${PREFIX}warehouse` },
    });
    return warehouse.id;
  }

  async function seedLocation(): Promise<string> {
    const location = await prisma.warehouseLocation.create({
      data: { warehouseId, name: `${PREFIX}loc` },
    });
    return location.id;
  }

  async function seedPackagingType(): Promise<string> {
    const type = await prisma.packagingType.create({
      data: { name: `${PREFIX}tara`, tareWeightKg: "0.000" },
    });
    return type.id;
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

  function auth(cookieValue = workerCookie): {
    cookies: Record<string, string>;
  } {
    return { cookies: { [AUTH_COOKIE_NAME]: cookieValue } };
  }

  async function createDeliveryOk(): Promise<IncomingDelivery> {
    const res = await app.inject({
      method: "POST",
      url: "/deliveries",
      ...auth(),
      payload: { supplierId, arrivalDate: ARRIVAL },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as IncomingDelivery;
  }

  async function resolveBatch(
    deliveryId: string,
    payload: Record<string, unknown>,
  ): Promise<BatchDetail> {
    const res = await app.inject({
      method: "POST",
      url: `/deliveries/${deliveryId}/batches`,
      ...auth(),
      payload,
    });
    expect(res.statusCode).toBe(201);
    return res.json() as BatchDetail;
  }

  async function getBatch(batchId: string): Promise<BatchDetail> {
    const res = await app.inject({
      method: "GET",
      url: `/batches/${batchId}`,
      ...auth(),
    });
    expect(res.statusCode).toBe(200);
    return res.json() as BatchDetail;
  }

  async function createWeightBatch(
    deliveryId: string,
    resourceId: string,
    weights: string[],
  ): Promise<BatchDetail> {
    const batch = await resolveBatch(deliveryId, {
      receivingMode: "WEIGHT",
      resourceId,
      warehouseId,
    });
    for (const grossWeight of weights) {
      const res = await app.inject({
        method: "POST",
        url: `/batches/${batch.id}/bags`,
        ...auth(),
        payload: { packagingTypeId, grossWeight, warehouseLocationId: locationId },
      });
      expect(res.statusCode).toBe(201);
    }
    return getBatch(batch.id);
  }

  async function createPieceBatch(
    deliveryId: string,
    items: { resourceId: string; quantity: number }[],
  ): Promise<BatchDetail> {
    const batch = await resolveBatch(deliveryId, {
      receivingMode: "PIECE",
      warehouseId,
    });
    for (const item of items) {
      const res = await app.inject({
        method: "POST",
        url: `/batches/${batch.id}/items`,
        ...auth(),
        payload: {
          resourceId: item.resourceId,
          warehouseLocationId: locationId,
          quantity: item.quantity,
        },
      });
      expect(res.statusCode).toBe(201);
    }
    return getBatch(batch.id);
  }

  async function reconcile(
    batchId: string,
    documentWeight: string,
    acquisitionAmount: string,
  ): Promise<{ statusCode: number; body: unknown }> {
    const res = await app.inject({
      method: "POST",
      url: `/batches/${batchId}/reconcile`,
      cookies: { [AUTH_COOKIE_NAME]: adminCookie },
      payload: { documentWeight, acquisitionAmount },
    });
    return { statusCode: res.statusCode, body: res.json() };
  }

  async function reconcileOk(
    batchId: string,
    documentWeight: string,
    acquisitionAmount: string,
  ): Promise<BatchReconciliation> {
    const { statusCode, body } = await reconcile(
      batchId,
      documentWeight,
      acquisitionAmount,
    );
    expect(statusCode).toBe(200);
    return body as BatchReconciliation;
  }

  async function confirmPiece(
    batchId: string,
    payload: Record<string, unknown>,
  ): Promise<{ statusCode: number; body: unknown }> {
    const res = await app.inject({
      method: "POST",
      url: `/batches/${batchId}/confirm-piece`,
      cookies: { [AUTH_COOKIE_NAME]: adminCookie },
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() };
  }

  async function confirmPieceCount(
    batchId: string,
    documentPieces: number,
    acquisitionAmount: string,
  ): Promise<void> {
    const result = await confirmPiece(batchId, {
      documentPieces,
      acquisitionAmount,
    });
    expect(result.statusCode).toBe(200);
  }

  async function getExpenses(
    deliveryId: string,
    cookieValue = adminCookie,
  ): Promise<DeliveryExpenses> {
    const res = await app.inject({
      method: "GET",
      url: `/deliveries/${deliveryId}/expenses`,
      cookies: { [AUTH_COOKIE_NAME]: cookieValue },
    });
    expect(res.statusCode).toBe(200);
    return res.json() as DeliveryExpenses;
  }

  async function putExpenses(
    deliveryId: string,
    payload: Record<string, unknown>,
    cookieValue = adminCookie,
  ): Promise<{ statusCode: number; body: unknown }> {
    const res = await app.inject({
      method: "PUT",
      url: `/deliveries/${deliveryId}/expenses`,
      cookies: { [AUTH_COOKIE_NAME]: cookieValue },
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() };
  }

  async function previewExpenses(
    deliveryId: string,
    payload: Record<string, unknown>,
    cookieValue = adminCookie,
  ): Promise<{ statusCode: number; body: unknown }> {
    const res = await app.inject({
      method: "POST",
      url: `/deliveries/${deliveryId}/expenses/preview`,
      cookies: { [AUTH_COOKIE_NAME]: cookieValue },
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() };
  }

  async function applyExpenses(
    deliveryId: string,
    payload: Record<string, unknown>,
    cookieValue = adminCookie,
  ): Promise<{ statusCode: number; body: unknown }> {
    const res = await app.inject({
      method: "POST",
      url: `/deliveries/${deliveryId}/expenses/apply`,
      cookies: { [AUTH_COOKIE_NAME]: cookieValue },
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() };
  }

  function expensePayload(
    transportAmount: string,
    customsAmount: string,
    allocationMethod: "BY_VALUE" | "EQUAL" = "BY_VALUE",
  ): Record<string, unknown> {
    return { transportAmount, customsAmount, allocationMethod };
  }

  async function allocated(
    batchId: string,
  ): Promise<{ transport: string | null; customs: string | null }> {
    const record = await prisma.batch.findUniqueOrThrow({
      where: { id: batchId },
      select: {
        allocatedTransportAmount: true,
        allocatedCustomsAmount: true,
      },
    });
    return {
      transport: record.allocatedTransportAmount?.toString() ?? null,
      customs: record.allocatedCustomsAmount?.toString() ?? null,
    };
  }

  async function stockSummary(): Promise<StockSummary> {
    const res = await app.inject({
      method: "GET",
      url: "/stock/summary",
      ...auth(),
    });
    expect(res.statusCode).toBe(200);
    return res.json() as StockSummary;
  }

  function value(summary: StockSummary, mode: "weight" | "pieces"): number {
    const raw = summary[mode].value;
    if (raw === null) {
      throw new Error("stock value is incomplete");
    }
    return Number(raw);
  }

  it("previews and applies proportional WEIGHT shares, then values confirmed stock", async () => {
    const delivery = await createDeliveryOk();
    const p01 = await createWeightBatch(delivery.id, resourceAId, ["10"]);
    const p02 = await createWeightBatch(delivery.id, resourceBId, ["30"]);

    const preview = await previewExpenses(delivery.id, expensePayload("80", "20"));
    expect(preview.statusCode).toBe(201);
    const proposed = preview.body as DeliveryExpensePreview;
    expect(proposed.batches.find((batch) => batch.batchId === p01.id)).toMatchObject({
      proposedTransportAmount: "20",
      proposedCustomsAmount: "5",
    });
    expect(proposed.batches.find((batch) => batch.batchId === p02.id)).toMatchObject({
      proposedTransportAmount: "60",
      proposedCustomsAmount: "15",
    });
    expect(proposed.unallocatedTransport).toBe("0");
    expect(proposed.unallocatedCustoms).toBe("0");

    const applied = await applyExpenses(delivery.id, expensePayload("80", "20"));
    expect(applied.statusCode).toBe(200);
    expect((applied.body as ApplyDeliveryExpensesResponse).applied).toBe(true);
    expect(await allocated(p01.id)).toEqual({ transport: "20", customs: "5" });
    expect(await allocated(p02.id)).toEqual({ transport: "60", customs: "15" });

    const before = await stockSummary();
    await reconcileOk(p01.id, "10", "100");
    const afterP01 = await stockSummary();
    expect(value(afterP01, "weight") - value(before, "weight")).toBeCloseTo(125, 3);
    await reconcileOk(p02.id, "30", "300");
    const afterP02 = await stockSummary();
    expect(value(afterP02, "weight") - value(afterP01, "weight")).toBeCloseTo(375, 3);
  });

  it("applies a late invoice to a confirmed batch and revisions only change valuation", async () => {
    const delivery = await createDeliveryOk();
    const p01 = await createWeightBatch(delivery.id, resourceAId, ["10"]);
    const p02 = await createWeightBatch(delivery.id, resourceBId, ["10"]);

    const before = await stockSummary();
    await reconcileOk(p01.id, "10", "100");
    const afterP01 = await stockSummary();
    expect(value(afterP01, "weight") - value(before, "weight")).toBeCloseTo(100, 3);
    expect(await allocated(p01.id)).toEqual({ transport: null, customs: null });

    const applied100 = await applyExpenses(delivery.id, expensePayload("100", "0"));
    expect(applied100.statusCode).toBe(200);
    expect(await allocated(p01.id)).toEqual({ transport: "50", customs: "0" });
    expect(await allocated(p02.id)).toEqual({ transport: "50", customs: "0" });
    const afterLateInvoice = await stockSummary();
    expect(value(afterLateInvoice, "weight") - value(afterP01, "weight")).toBeCloseTo(50, 3);
    expect((await getBatch(p01.id)).bagCount).toBe(1);

    await reconcileOk(p02.id, "10", "200");
    const afterP02 = await stockSummary();
    expect(value(afterP02, "weight") - value(afterLateInvoice, "weight")).toBeCloseTo(250, 3);

    const applied120 = await applyExpenses(delivery.id, expensePayload("120", "0"));
    expect(applied120.statusCode).toBe(200);
    expect((applied120.body as ApplyDeliveryExpensesResponse).applied).toBe(true);
    expect(await allocated(p01.id)).toEqual({ transport: "60", customs: "0" });
    expect(await allocated(p02.id)).toEqual({ transport: "60", customs: "0" });
    const afterRevision = await stockSummary();
    expect(value(afterRevision, "weight") - value(afterP02, "weight")).toBeCloseTo(20, 3);

    const applications = await prisma.deliveryExpenseApplication.findMany({
      where: { deliveryId: delivery.id },
      orderBy: { appliedAt: "asc" },
      include: { appliedBy: true, entries: true },
    });
    expect(applications).toHaveLength(2);
    expect(applications[0]?.transportAmount.toString()).toBe("100");
    expect(applications[1]?.transportAmount.toString()).toBe("120");
    expect(applications[1]?.appliedBy.username).toBe(`${PREFIX}admin`);
    const p01Entry = applications[1]?.entries.find(
      (entry) => entry.batchId === p01.id,
    );
    expect(p01Entry).toMatchObject({
      previousTransportAmount: expect.anything(),
      newTransportAmount: expect.anything(),
    });
    expect(p01Entry?.previousTransportAmount.toString()).toBe("50");
    expect(p01Entry?.newTransportAmount.toString()).toBe("60");

    const identical = await applyExpenses(delivery.id, expensePayload("120", "0"));
    expect(identical.statusCode).toBe(200);
    expect((identical.body as ApplyDeliveryExpensesResponse).applied).toBe(false);
    expect(
      await prisma.deliveryExpenseApplication.count({
        where: { deliveryId: delivery.id },
      }),
    ).toBe(2);
    expect(value(await stockSummary(), "weight")).toBeCloseTo(
      value(afterRevision, "weight"),
      6,
    );
    const finalPreview = identical.body as ApplyDeliveryExpensesResponse;
    expect(finalPreview.allocatedTransportTotal).toBe("120");
    expect(finalPreview.unallocatedTransport).toBe("0");
  });

  it("supports equal allocation", async () => {
    const delivery = await createDeliveryOk();
    const w1 = await createWeightBatch(delivery.id, resourceAId, ["10"]);
    const w2 = await createWeightBatch(delivery.id, resourceBId, ["30"]);
    const equal = await applyExpenses(
      delivery.id,
      expensePayload("80", "20", "EQUAL"),
    );
    expect(equal.statusCode).toBe(200);
    expect(await allocated(w1.id)).toEqual({ transport: "40", customs: "10" });
    expect(await allocated(w2.id)).toEqual({ transport: "40", customs: "10" });
  });

  it("switches a mixed receipt from equal to acquisition-based allocation", async () => {
    const delivery = await createDeliveryOk();
    const piece = await createPieceBatch(delivery.id, [
      { resourceId: resourceAId, quantity: 240 },
    ]);
    const weight = await createWeightBatch(delivery.id, resourceBId, ["1214"]);
    await confirmPieceCount(piece.id, 240, "6000");
    await reconcileOk(weight.id, "1214", "4000");

    const equal = await applyExpenses(
      delivery.id,
      expensePayload("2000", "350", "EQUAL"),
    );
    expect(equal.statusCode).toBe(200);
    expect(await allocated(piece.id)).toEqual({
      transport: "1000",
      customs: "175",
    });
    expect(await allocated(weight.id)).toEqual({
      transport: "1000",
      customs: "175",
    });

    const preview = await previewExpenses(
      delivery.id,
      expensePayload("2000", "350", "BY_VALUE"),
    );
    expect(preview.statusCode).toBe(201);
    const previewBody = preview.body as DeliveryExpensePreview;
    expect(previewBody.proportionalAvailable).toBe(true);
    expect(previewBody.basis).toBe("ACQUISITION");
    expect(
      previewBody.batches.find((batch) => batch.batchId === piece.id),
    ).toMatchObject({
      acquisitionAmount: "6000",
      proposedTransportAmount: "1200",
      proposedCustomsAmount: "210",
    });
    expect(
      previewBody.batches.find((batch) => batch.batchId === weight.id),
    ).toMatchObject({
      acquisitionAmount: "4000",
      proposedTransportAmount: "800",
      proposedCustomsAmount: "140",
    });

    const applied = await applyExpenses(
      delivery.id,
      expensePayload("2000", "350", "BY_VALUE"),
    );
    expect(applied.statusCode).toBe(200);
    expect(await allocated(piece.id)).toEqual({
      transport: "1200",
      customs: "210",
    });
    expect(await allocated(weight.id)).toEqual({
      transport: "800",
      customs: "140",
    });
    const pieceAfter = await getBatch(piece.id);
    const weightAfter = await getBatch(weight.id);
    expect(pieceAfter.totalPieces).toBe(240);
    expect(weightAfter.totalNetWeight).toBe("1214");

    const applications = await prisma.deliveryExpenseApplication.findMany({
      where: { deliveryId: delivery.id },
      orderBy: { appliedAt: "asc" },
      include: { entries: true },
    });
    expect(applications).toHaveLength(2);
    const pieceEntry = applications[1]?.entries.find(
      (entry) => entry.batchId === piece.id,
    );
    expect(pieceEntry?.previousTransportAmount.toString()).toBe("1000");
    expect(pieceEntry?.newTransportAmount.toString()).toBe("1200");
    expect(pieceEntry?.previousCustomsAmount.toString()).toBe("175");
    expect(pieceEntry?.newCustomsAmount.toString()).toBe("210");

    const identical = await applyExpenses(
      delivery.id,
      expensePayload("2000", "350", "BY_VALUE"),
    );
    expect(identical.statusCode).toBe(200);
    expect((identical.body as ApplyDeliveryExpensesResponse).applied).toBe(false);
    expect(
      await prisma.deliveryExpenseApplication.count({
        where: { deliveryId: delivery.id },
      }),
    ).toBe(2);
  });

  it("blocks mixed proportional allocation when an acquisition value is missing or all zero", async () => {
    const missingDelivery = await createDeliveryOk();
    const missingPiece = await createPieceBatch(missingDelivery.id, [
      { resourceId: resourceAId, quantity: 10 },
    ]);
    const missingWeight = await createWeightBatch(
      missingDelivery.id,
      resourceBId,
      ["10"],
    );
    await confirmPieceCount(missingPiece.id, 10, "100");

    const missingPreview = await previewExpenses(
      missingDelivery.id,
      expensePayload("10", "5", "BY_VALUE"),
    );
    expect(missingPreview.statusCode).toBe(201);
    expect((missingPreview.body as DeliveryExpensePreview).proportionalAvailable).toBe(
      false,
    );
    expect(
      (missingPreview.body as DeliveryExpensePreview).proportionalBlockedReason,
    ).toContain(missingWeight.code);

    const rejected = await applyExpenses(
      missingDelivery.id,
      expensePayload("10", "5", "BY_VALUE"),
    );
    expect(rejected.statusCode).toBe(400);
    expect((rejected.body as { code: string }).code).toBe(
      "ACQUISITION_BASIS_UNAVAILABLE",
    );
    const equal = await applyExpenses(
      missingDelivery.id,
      expensePayload("10", "5", "EQUAL"),
    );
    expect(equal.statusCode).toBe(200);
    expect(await allocated(missingPiece.id)).toEqual({
      transport: "5",
      customs: "2.5",
    });

    const zeroDelivery = await createDeliveryOk();
    const zeroPiece = await createPieceBatch(zeroDelivery.id, [
      { resourceId: resourceAId, quantity: 10 },
    ]);
    const zeroWeight = await createWeightBatch(zeroDelivery.id, resourceBId, [
      "10",
    ]);
    await confirmPieceCount(zeroPiece.id, 10, "0");
    await reconcileOk(zeroWeight.id, "10", "0");
    const zeroPreview = await previewExpenses(
      zeroDelivery.id,
      expensePayload("10", "5", "BY_VALUE"),
    );
    expect((zeroPreview.body as DeliveryExpensePreview).proportionalAvailable).toBe(
      false,
    );
    expect(
      (zeroPreview.body as DeliveryExpensePreview).proportionalBlockedReason,
    ).toContain("0");
    const zeroRejected = await applyExpenses(
      zeroDelivery.id,
      expensePayload("10", "5", "BY_VALUE"),
    );
    expect(zeroRejected.statusCode).toBe(400);
    expect((zeroRejected.body as { code: string }).code).toBe(
      "ACQUISITION_BASIS_UNAVAILABLE",
    );
  });

  it("allocates to the cent with largest-remainder rounding", async () => {
    const delivery = await createDeliveryOk();
    const p01 = await createWeightBatch(delivery.id, resourceAId, ["1"]);
    const p02 = await createWeightBatch(delivery.id, resourceBId, ["2"]);
    const applied = await applyExpenses(
      delivery.id,
      expensePayload("0.01", "0.02"),
    );
    expect(applied.statusCode).toBe(200);
    const first = await allocated(p01.id);
    const second = await allocated(p02.id);
    expect(Number(first.transport) + Number(second.transport)).toBeCloseTo(0.01, 2);
    expect(Number(first.customs) + Number(second.customs)).toBeCloseTo(0.02, 2);
    const preview = applied.body as ApplyDeliveryExpensesResponse;
    expect(preview.allocatedTransportTotal).toBe("0.01");
    expect(preview.allocatedCustomsTotal).toBe("0.02");
  });

  it("keeps confirmation independent of a saved draft expense record", async () => {
    const delivery = await createDeliveryOk();
    const batch = await createWeightBatch(delivery.id, resourceAId, ["5"]);
    expect(await getExpenses(delivery.id)).toMatchObject({
      transportAmount: "0",
      customsAmount: "0",
      updatedAt: null,
    });
    const saved = await putExpenses(delivery.id, expensePayload("50", "0"));
    expect(saved.statusCode).toBe(200);
    await reconcileOk(batch.id, "5", "50");
    expect(await allocated(batch.id)).toEqual({
      transport: null,
      customs: null,
    });
  });

  it("treats a zero apply with no existing record as a no-op", async () => {
    const delivery = await createDeliveryOk();
    await createWeightBatch(delivery.id, resourceAId, ["1"]);
    const result = await applyExpenses(delivery.id, expensePayload("0", "0"));
    expect(result.statusCode).toBe(200);
    expect((result.body as ApplyDeliveryExpensesResponse).applied).toBe(false);
    expect(
      await prisma.deliveryExpenseApplication.count({
        where: { deliveryId: delivery.id },
      }),
    ).toBe(0);
  });

  it("keeps financial endpoints and actions administrator-only", async () => {
    const delivery = await createDeliveryOk();
    await createWeightBatch(delivery.id, resourceAId, ["1"]);

    const read = await app.inject({
      method: "GET",
      url: `/deliveries/${delivery.id}/expenses`,
      ...auth(),
    });
    expect(read.statusCode).toBe(403);
    const preview = await previewExpenses(
      delivery.id,
      expensePayload("1", "1"),
      workerCookie,
    );
    expect(preview.statusCode).toBe(403);
    const apply = await applyExpenses(
      delivery.id,
      expensePayload("1", "1"),
      workerCookie,
    );
    expect(apply.statusCode).toBe(403);
  });

  it("rejects invalid amounts and an unknown receipt for administrators", async () => {
    const delivery = await createDeliveryOk();
    await createWeightBatch(delivery.id, resourceAId, ["1"]);

    for (const transportAmount of ["", "-1", "1,234", "abc"]) {
      const res = await putExpenses(
        delivery.id,
        expensePayload(transportAmount, "0"),
      );
      expect(res.statusCode).toBe(400);
    }

    const missing = await app.inject({
      method: "GET",
      url: "/deliveries/99999999-9999-4999-8999-999999999999/expenses",
      cookies: { [AUTH_COOKIE_NAME]: adminCookie },
    });
    expect(missing.statusCode).toBe(404);
  });

  it("confirms a PIECE batch with one aggregate documented count", async () => {
    const delivery = await createDeliveryOk();
    const batch = await createPieceBatch(delivery.id, [
      { resourceId: resourceAId, quantity: 18 },
    ]);

    const rejected = await confirmPiece(batch.id, {
      documentPieces: 20,
      acquisitionAmount: "20",
    });
    expect(rejected.statusCode).toBe(400);
    expect((rejected.body as { code: string }).code).toBe(
      "DISCREPANCY_NOT_ACKNOWLEDGED",
    );

    const accepted = await confirmPiece(batch.id, {
      documentPieces: 20,
      acquisitionAmount: "20",
      acknowledgeDiscrepancies: true,
    });
    expect(accepted.statusCode).toBe(200);
    const result = accepted.body as BatchPieceConfirmation;
    expect(result.totalPieces).toBe(18);
    expect(result.totalDocumentPieces).toBe(20);
    expect(
      (
        await prisma.batch.findUniqueOrThrow({
          where: { id: batch.id },
          select: { documentPieces: true },
        })
      ).documentPieces,
    ).toBe(20);
  });
});
