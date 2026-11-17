import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type {
  Batch,
  BatchDetail,
  BatchItem,
  BatchPieceConfirmation,
  IncomingDelivery,
  IncomingDeliveryDetail,
  Resource,
  RoleKey,
} from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { hashPassword } from "../src/modules/auth/password";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_piece_";
const ARRIVAL = "2026-10-02T00:00:00.000Z";

describe.skipIf(!dbAvailable)("Piece batches (integration)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let workerCookie: string;

  let supplierId: string;
  let alphaId: string;
  let betaId: string;
  let warehouseId: string;
  let locationAId: string;
  let locationBId: string;
  let otherWarehouseId: string;
  let otherLocationId: string;
  let categoryId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await cleanup();
    await seedUser("admin", "admin-password-123", ["ADMIN"]);
    await seedUser("worker", "worker-password-123", ["WAREHOUSE_WORKER"]);
    adminCookie = await login(`${PREFIX}admin`, "admin-password-123");
    workerCookie = await login(`${PREFIX}worker`, "worker-password-123");

    categoryId = (
      await prisma.resourceCategory.findFirstOrThrow({
        where: { name: "Žaliava" },
      })
    ).id;
    supplierId = await seedPartner();
    alphaId = await seedResource("alpha");
    betaId = await seedResource("beta");
    warehouseId = await seedWarehouse("warehouse");
    locationAId = await seedLocation(warehouseId, "a");
    locationBId = await seedLocation(warehouseId, "b");
    otherWarehouseId = await seedWarehouse("other");
    otherLocationId = await seedLocation(otherWarehouseId, "x");
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
    const byBatch = {
      batch: { delivery: { supplier: { name: { startsWith: PREFIX } } } },
    } as const;
    await prisma.receivingDiscrepancy.deleteMany({ where: byBatch });
    await prisma.pieceReconciliationLine.deleteMany({ where: byBatch });
    await prisma.batchItem.deleteMany({ where: byBatch });
    await prisma.batchItem.deleteMany({
      where: { resource: { name: { startsWith: PREFIX } } },
    });
    await prisma.batch.deleteMany({
      where: { delivery: { supplier: { name: { startsWith: PREFIX } } } },
    });
    await prisma.incomingDelivery.deleteMany({
      where: { supplier: { name: { startsWith: PREFIX } } },
    });
    await prisma.warehouseLocation.deleteMany({
      where: { warehouse: { name: { startsWith: PREFIX } } },
    });
    await prisma.warehouse.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.businessPartner.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    await prisma.resource.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({
      where: { username: { startsWith: PREFIX } },
    });
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

  async function seedResource(suffix: string): Promise<string> {
    const resource = await prisma.resource.create({
      data: { name: `${PREFIX}${suffix}`, categoryId },
    });
    return resource.id;
  }

  async function seedWarehouse(suffix: string): Promise<string> {
    const warehouse = await prisma.warehouse.create({
      data: { name: `${PREFIX}${suffix}` },
    });
    return warehouse.id;
  }

  async function seedLocation(
    warehouseIdValue: string,
    suffix: string,
  ): Promise<string> {
    const location = await prisma.warehouseLocation.create({
      data: { warehouseId: warehouseIdValue, name: `${PREFIX}loc-${suffix}` },
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

  function auth(cookieValue = workerCookie): { cookies: Record<string, string> } {
    return { cookies: { [AUTH_COOKIE_NAME]: cookieValue } };
  }

  async function createDelivery(): Promise<IncomingDelivery> {
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
  ): Promise<{ statusCode: number; body: BatchDetail }> {
    const res = await app.inject({
      method: "POST",
      url: `/deliveries/${deliveryId}/batches`,
      ...auth(),
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() as BatchDetail };
  }

  async function createPieceBatch(): Promise<BatchDetail> {
    const delivery = await createDelivery();
    const { statusCode, body } = await resolveBatch(delivery.id, {
      receivingMode: "PIECE",
      warehouseId,
    });
    expect(statusCode).toBe(201);
    expect(body.receivingMode).toBe("PIECE");
    expect(body.resourceId).toBeNull();
    return body;
  }

  async function addItem(
    batchId: string,
    payload: Record<string, unknown>,
  ): Promise<{ statusCode: number; body: BatchItem }> {
    const res = await app.inject({
      method: "POST",
      url: `/batches/${batchId}/items`,
      ...auth(),
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() as BatchItem };
  }

  async function patchRegistration(
    batchId: string,
    payload: Record<string, unknown>,
  ): Promise<{ statusCode: number; body: BatchDetail }> {
    const res = await app.inject({
      method: "PATCH",
      url: `/batches/${batchId}/registration`,
      ...auth(),
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() as BatchDetail };
  }

  it("starts a PIECE batch with only a warehouse (no batch resource)", async () => {
    const delivery = await createDelivery();
    const missingWarehouse = await resolveBatch(delivery.id, {
      receivingMode: "PIECE",
    });
    expect(missingWarehouse.statusCode).toBe(400);

    const withResource = await resolveBatch(delivery.id, {
      receivingMode: "PIECE",
      resourceId: alphaId,
      warehouseId,
    });
    expect(withResource.statusCode).toBe(400);
    expect(
      (withResource.body as unknown as { code: string }).code,
    ).toBe("RESOURCE_NOT_ALLOWED");

    const piece = await resolveBatch(delivery.id, {
      receivingMode: "PIECE",
      warehouseId,
    });
    expect(piece.statusCode).toBe(201);
    expect(piece.body.receivingMode).toBe("PIECE");
    expect(piece.body.resourceId).toBeNull();
    expect(piece.body.resourceName).toBeNull();
    expect(piece.body.itemLineCount).toBe(0);
    expect(piece.body.totalPieces).toBe(0);
  });

  it("still requires a resource for a WEIGHT batch", async () => {
    const delivery = await createDelivery();
    const res = await resolveBatch(delivery.id, {
      receivingMode: "WEIGHT",
      warehouseId,
    });
    expect(res.statusCode).toBe(400);
    expect((res.body as unknown as { code: string }).code).toBe(
      "RESOURCE_REQUIRED",
    );
  });

  it("adds several different products to one batch and derives totals", async () => {
    const batch = await createPieceBatch();
    expect(
      (await addItem(batch.id, {
        resourceId: alphaId,
        warehouseLocationId: locationAId,
        quantity: 120,
      })).statusCode,
    ).toBe(201);
    expect(
      (await addItem(batch.id, {
        resourceId: betaId,
        warehouseLocationId: locationAId,
        quantity: 34,
      })).statusCode,
    ).toBe(201);
    // Same product in a different location -> a second line.
    expect(
      (await addItem(batch.id, {
        resourceId: alphaId,
        warehouseLocationId: locationBId,
        quantity: 6,
      })).statusCode,
    ).toBe(201);

    const detail = await app
      .inject({ method: "GET", url: `/batches/${batch.id}`, ...auth() })
      .then((res) => res.json() as BatchDetail);
    expect(detail.items).toHaveLength(3);
    expect(detail.itemLineCount).toBe(3);
    expect(detail.totalPieces).toBe(160);
    const alphaLines = detail.items.filter((i) => i.resourceId === alphaId);
    expect(alphaLines).toHaveLength(2);
  });

  it("rejects non-positive or non-integer quantities and wrong-warehouse locations", async () => {
    const batch = await createPieceBatch();
    for (const quantity of [0, -1, 1.5]) {
      const res = await addItem(batch.id, {
        resourceId: alphaId,
        warehouseLocationId: locationAId,
        quantity,
      });
      expect(res.statusCode).toBe(400);
    }
    const wrongWarehouse = await addItem(batch.id, {
      resourceId: alphaId,
      warehouseLocationId: otherLocationId,
      quantity: 5,
    });
    expect(wrongWarehouse.statusCode).toBe(400);
  });

  it("rejects item lines on a WEIGHT batch and packages on a PIECE batch", async () => {
    const delivery = await createDelivery();
    const weight = await resolveBatch(delivery.id, {
      receivingMode: "WEIGHT",
      resourceId: alphaId,
      warehouseId,
    });
    expect(weight.statusCode).toBe(201);
    const itemOnWeight = await addItem(weight.body.id, {
      resourceId: betaId,
      warehouseLocationId: locationAId,
      quantity: 1,
    });
    expect(itemOnWeight.statusCode).toBe(400);
    expect(
      (itemOnWeight.body as unknown as { code: string }).code,
    ).toBe("BATCH_NOT_PIECE");

    const piece = await createPieceBatch();
    const bagOnPiece = await app.inject({
      method: "POST",
      url: `/batches/${piece.id}/bags`,
      ...auth(),
      payload: {
        packagingTypeId: "00000000-0000-4000-8000-000000000000",
        grossWeight: "1",
        warehouseLocationId: locationAId,
      },
    });
    expect(bagOnPiece.statusCode).toBe(400);
    expect((bagOnPiece.json() as { code: string }).code).toBe("BATCH_NOT_WEIGHT");
  });

  it("corrects and voidly removes item lines while PENDING", async () => {
    const batch = await createPieceBatch();
    const created = await addItem(batch.id, {
      resourceId: alphaId,
      warehouseLocationId: locationAId,
      quantity: 10,
    });
    const itemId = created.body.id;

    const summary = async (): Promise<Batch> =>
      (
        await app
          .inject({
            method: "GET",
            url: `/deliveries/${batch.deliveryId}`,
            ...auth(),
          })
          .then((res) => res.json() as IncomingDeliveryDetail)
      ).batches.find((b) => b.id === batch.id)!;
    expect(await summary()).toMatchObject({
      itemLineCount: 1,
      totalPieces: 10,
    });

    const corrected = await app.inject({
      method: "PATCH",
      url: `/batches/${batch.id}/items/${itemId}`,
      ...auth(),
      payload: { quantity: 12, warehouseLocationId: locationBId },
    });
    expect(corrected.statusCode).toBe(200);
    const correctedBody = corrected.json() as BatchItem;
    expect(correctedBody.quantity).toBe(12);
    expect(correctedBody.warehouseLocationId).toBe(locationBId);
    expect(await summary()).toMatchObject({
      itemLineCount: 1,
      totalPieces: 12,
    });

    const voided = await app.inject({
      method: "POST",
      url: `/batches/${batch.id}/items/${itemId}/void`,
      ...auth(),
      payload: { reason: "count mistake" },
    });
    expect(voided.statusCode).toBe(200);
    const voidedBody = voided.json() as BatchItem;
    expect(voidedBody.status).toBe("VOIDED");
    expect(voidedBody.voidReason).toBe("count mistake");
    expect(voidedBody.voidedById).toBeTruthy();

    // The voided line no longer counts; the row is preserved.
    const detail = await app
      .inject({ method: "GET", url: `/batches/${batch.id}`, ...auth() })
      .then((res) => res.json() as BatchDetail);
    expect(detail.items).toHaveLength(1);
    expect(detail.itemLineCount).toBe(0);
    expect(detail.totalPieces).toBe(0);
    // The parent delivery summary reflects the void immediately.
    expect(await summary()).toMatchObject({
      itemLineCount: 0,
      totalPieces: 0,
    });
  });

  it("confirms an all-matching PIECE batch with no discrepancy", async () => {
    const batch = await createPieceBatch();
    const g1 = await addItem(batch.id, {
      resourceId: alphaId,
      warehouseLocationId: locationAId,
      quantity: 120,
    });
    await addItem(batch.id, {
      resourceId: betaId,
      warehouseLocationId: locationBId,
      quantity: 34,
    });

    // The (weight) reconcile endpoint rejects a PIECE batch.
    const reconcile = await app.inject({
      method: "POST",
      url: `/batches/${batch.id}/reconcile`,
      cookies: { [AUTH_COOKIE_NAME]: adminCookie },
      payload: { documentWeight: "1", acquisitionAmount: "0" },
    });
    expect(reconcile.statusCode).toBe(400);
    expect((reconcile.json() as { code: string }).code).toBe("BATCH_NOT_WEIGHT");

    const confirm = await app.inject({
      method: "POST",
      url: `/batches/${batch.id}/confirm-piece`,
      cookies: { [AUTH_COOKIE_NAME]: adminCookie },
      payload: {
        acquisitionAmount: "1250.50",
        documentDate: ARRIVAL,
        documentNumber: "SF-100",
        products: [
          { resourceId: alphaId, documentPieces: 120 },
          { resourceId: betaId, documentPieces: 34 },
        ],
      },
    });
    expect(confirm.statusCode).toBe(200);
    const result = confirm.json() as BatchPieceConfirmation;
    expect(result.status).toBe("CONFIRMED");
    expect(result.totalPieces).toBe(154);
    expect(result.totalDocumentPieces).toBe(154);
    expect(result.itemLineCount).toBe(2);
    expect(result.acquisitionAmount).toBe("1250.5");
    expect(result.documentNumber).toBe("SF-100");
    expect(result.lines).toHaveLength(2);
    expect(result.lines.every((line) => line.differencePieces === 0)).toBe(true);

    const detail = await app
      .inject({ method: "GET", url: `/batches/${batch.id}`, ...auth() })
      .then((res) => res.json() as BatchDetail);
    expect(detail.status).toBe("CONFIRMED");
    expect(detail.hasOpenDiscrepancy).toBe(false);
    // Confirmed group barcodes are preserved.
    expect(detail.items).toHaveLength(2);
    for (const item of detail.items) {
      expect(item.barcode).toMatch(/^\d{13}$/);
    }
    expect(detail.items.find((i) => i.id === g1.body.id)!.barcode).toBe(
      g1.body.barcode,
    );
    const discrepancies = await prisma.receivingDiscrepancy.count({
      where: { batchId: batch.id },
    });
    expect(discrepancies).toBe(0);

    // A confirmed PIECE batch is frozen through the receiving endpoints.
    const lateItem = await addItem(batch.id, {
      resourceId: alphaId,
      warehouseLocationId: locationAId,
      quantity: 1,
    });
    expect(lateItem.statusCode).toBe(409);
    expect((lateItem.body as unknown as { code: string }).code).toBe(
      "BATCH_CONFIRMED",
    );
    const lateCorrect = await app.inject({
      method: "PATCH",
      url: `/batches/${batch.id}/items/${g1.body.id}`,
      ...auth(),
      payload: { quantity: 5 },
    });
    expect(lateCorrect.statusCode).toBe(409);
    const lateVoid = await app.inject({
      method: "POST",
      url: `/batches/${batch.id}/items/${g1.body.id}/void`,
      ...auth(),
      payload: {},
    });
    expect(lateVoid.statusCode).toBe(409);
  });

  it("aggregates the same resource across groups and reconciles per product", async () => {
    const batch = await createPieceBatch();
    await addItem(batch.id, {
      resourceId: alphaId,
      warehouseLocationId: locationAId,
      quantity: 30,
    });
    await addItem(batch.id, {
      resourceId: alphaId,
      warehouseLocationId: locationBId,
      quantity: 30,
    });
    await addItem(batch.id, {
      resourceId: betaId,
      warehouseLocationId: locationAId,
      quantity: 100,
    });

    // Server-derived aggregate: one row per resource (alpha 60, not two rows).
    const pending = await app
      .inject({ method: "GET", url: `/batches/${batch.id}`, ...auth() })
      .then((res) => res.json() as BatchDetail);
    expect(pending.pieceReconciliation).toHaveLength(2);
    const alphaRow = pending.pieceReconciliation.find(
      (row) => row.resourceId === alphaId,
    )!;
    expect(alphaRow.actualPieces).toBe(60);
    expect(alphaRow.documentPieces).toBeNull();

    const confirm = await app.inject({
      method: "POST",
      url: `/batches/${batch.id}/confirm-piece`,
      cookies: { [AUTH_COOKIE_NAME]: adminCookie },
      payload: {
        acquisitionAmount: "500",
        products: [
          { resourceId: alphaId, documentPieces: 65 },
          { resourceId: betaId, documentPieces: 100 },
        ],
        acknowledgeDiscrepancies: true,
      },
    });
    expect(confirm.statusCode).toBe(200);
    const result = confirm.json() as BatchPieceConfirmation;
    const alphaLine = result.lines.find((line) => line.resourceId === alphaId)!;
    expect(alphaLine).toMatchObject({
      actualPieces: 60,
      documentPieces: 65,
      differencePieces: -5,
    });
    expect(result.lines.find((line) => line.resourceId === betaId)!.differencePieces).toBe(
      0,
    );
    expect(result.totalDocumentPieces).toBe(165);

    // Exactly one PIECE discrepancy (alpha), carrying piece quantities only.
    const rows = await prisma.receivingDiscrepancy.findMany({
      where: { batchId: batch.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "PIECE",
      resourceId: alphaId,
      actualPieces: 60,
      documentPieces: 65,
      differencePieces: -5,
      measuredWeight: null,
      documentWeight: null,
      differenceWeight: null,
    });
    expect(
      await prisma.pieceReconciliationLine.count({ where: { batchId: batch.id } }),
    ).toBe(2);
  });

  it("rejects a mismatch without acknowledgement and changes nothing", async () => {
    const batch = await createPieceBatch();
    await addItem(batch.id, {
      resourceId: alphaId,
      warehouseLocationId: locationAId,
      quantity: 60,
    });
    const rejected = await app.inject({
      method: "POST",
      url: `/batches/${batch.id}/confirm-piece`,
      cookies: { [AUTH_COOKIE_NAME]: adminCookie },
      payload: {
        acquisitionAmount: "10",
        products: [{ resourceId: alphaId, documentPieces: 65 }],
      },
    });
    expect(rejected.statusCode).toBe(400);
    expect((rejected.json() as { code: string }).code).toBe(
      "DISCREPANCY_NOT_ACKNOWLEDGED",
    );
    const detail = await app
      .inject({ method: "GET", url: `/batches/${batch.id}`, ...auth() })
      .then((res) => res.json() as BatchDetail);
    expect(detail.status).toBe("PENDING");
    expect(
      await prisma.pieceReconciliationLine.count({ where: { batchId: batch.id } }),
    ).toBe(0);
    expect(
      await prisma.receivingDiscrepancy.count({ where: { batchId: batch.id } }),
    ).toBe(0);
  });

  it("ignores voided groups and does not duplicate on confirmation retry", async () => {
    const batch = await createPieceBatch();
    const keep = await addItem(batch.id, {
      resourceId: alphaId,
      warehouseLocationId: locationAId,
      quantity: 60,
    });
    const drop = await addItem(batch.id, {
      resourceId: alphaId,
      warehouseLocationId: locationBId,
      quantity: 40,
    });
    await app.inject({
      method: "POST",
      url: `/batches/${batch.id}/items/${drop.body.id}/void`,
      ...auth(),
      payload: {},
    });

    const payload = {
      acquisitionAmount: "10",
      products: [{ resourceId: alphaId, documentPieces: 60 }],
    };
    const first = await app.inject({
      method: "POST",
      url: `/batches/${batch.id}/confirm-piece`,
      cookies: { [AUTH_COOKIE_NAME]: adminCookie },
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect((first.json() as BatchPieceConfirmation).totalPieces).toBe(60);
    expect(keep.body.id).toBeTruthy();

    // Retry: no duplicate reconciliation or discrepancy rows.
    const retry = await app.inject({
      method: "POST",
      url: `/batches/${batch.id}/confirm-piece`,
      cookies: { [AUTH_COOKIE_NAME]: adminCookie },
      payload,
    });
    expect(retry.statusCode).toBe(409);
    expect(
      await prisma.pieceReconciliationLine.count({ where: { batchId: batch.id } }),
    ).toBe(1);
    expect(
      await prisma.receivingDiscrepancy.count({ where: { batchId: batch.id } }),
    ).toBe(0);
  });

  it("resumes a PENDING PIECE batch without allocating a new code", async () => {
    const delivery = await createDelivery();
    const first = await resolveBatch(delivery.id, {
      receivingMode: "PIECE",
      warehouseId,
    });
    expect(first.statusCode).toBe(201);
    const p01 = first.body;
    await addItem(p01.id, {
      resourceId: alphaId,
      warehouseLocationId: locationAId,
      quantity: 30,
    });
    await addItem(p01.id, {
      resourceId: betaId,
      warehouseLocationId: locationAId,
      quantity: 70,
    });

    // Leave and re-fetch the delivery: P01 remains, still the only batch, and the
    // server-derived summary already reflects the two groups.
    const detail = await app
      .inject({ method: "GET", url: `/deliveries/${delivery.id}`, ...auth() })
      .then((res) => res.json() as IncomingDeliveryDetail);
    expect(detail.batches).toHaveLength(1);
    expect(detail.batches[0]!.id).toBe(p01.id);
    expect(detail.batches[0]!.code).toBe(p01.code);
    expect(detail.batches[0]!.itemLineCount).toBe(2);
    expect(detail.batches[0]!.totalPieces).toBe(100);

    // Reopen P01: the existing groups are restored.
    const reopened = await app
      .inject({ method: "GET", url: `/batches/${p01.id}`, ...auth() })
      .then((res) => res.json() as BatchDetail);
    expect(reopened.items).toHaveLength(2);
    expect(reopened.totalPieces).toBe(100);

    // Continue: add a third group; still only P01, total 150.
    await addItem(p01.id, {
      resourceId: alphaId,
      warehouseLocationId: locationBId,
      quantity: 50,
    });
    const after = await app
      .inject({ method: "GET", url: `/deliveries/${delivery.id}`, ...auth() })
      .then((res) => res.json() as IncomingDeliveryDetail);
    expect(after.batches).toHaveLength(1);
    expect(after.batches[0]!.itemLineCount).toBe(3);
    expect(after.batches[0]!.totalPieces).toBe(150);

    // Only an explicit new-batch action creates another batch.
    const second = await resolveBatch(delivery.id, {
      receivingMode: "PIECE",
      warehouseId,
    });
    expect(second.statusCode).toBe(201);
    expect(second.body.id).not.toBe(p01.id);
    expect(second.body.code).not.toBe(p01.code);
    const withSecond = await app
      .inject({ method: "GET", url: `/deliveries/${delivery.id}`, ...auth() })
      .then((res) => res.json() as IncomingDeliveryDetail);
    expect(withSecond.batches).toHaveLength(2);
  });

  it("gives each PIECE group a unique barcode identifying its identity", async () => {
    const batch = await createPieceBatch();
    const a = await addItem(batch.id, {
      resourceId: alphaId,
      warehouseLocationId: locationAId,
      quantity: 10,
    });
    const b = await addItem(batch.id, {
      resourceId: alphaId,
      warehouseLocationId: locationBId,
      quantity: 5,
    });
    expect(a.body.barcode).toMatch(/^\d{13}$/);
    expect(b.body.barcode).toMatch(/^\d{13}$/);
    // Same product, different group -> different barcodes.
    expect(a.body.barcode).not.toBe(b.body.barcode);
    expect(a.body.resourceId).toBe(alphaId);
    expect(a.body.batchId).toBe(batch.id);
    expect(a.body.warehouseLocationId).toBe(locationAId);

    // Re-fetch keeps the same barcode (a reprint creates nothing).
    const detail = await app
      .inject({ method: "GET", url: `/batches/${batch.id}`, ...auth() })
      .then((res) => res.json() as BatchDetail);
    expect(detail.items).toHaveLength(2);
    expect(detail.items.find((i) => i.id === a.body.id)!.barcode).toBe(
      a.body.barcode,
    );
  });

  it("quick-creates a product from receiving (worker) but not broad resource admin", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/resources/receiving-quick-create",
      ...auth(),
      payload: { name: `${PREFIX}quick-prod`, categoryId },
    });
    expect(created.statusCode).toBe(201);
    const resource = created.json() as Resource;
    expect(resource.name).toBe(`${PREFIX}quick-prod`);
    expect(resource.active).toBe(true);

    // The worker still cannot use the administrative resource endpoints.
    const adminOnly = await app.inject({
      method: "POST",
      url: "/resources",
      ...auth(),
      payload: { name: `${PREFIX}nope`, categoryId },
    });
    expect(adminOnly.statusCode).toBe(403);

    // The new product is selectable and can be used in a PIECE batch.
    const batch = await createPieceBatch();
    const item = await addItem(batch.id, {
      resourceId: resource.id,
      warehouseLocationId: locationAId,
      quantity: 3,
    });
    expect(item.statusCode).toBe(201);
    expect(item.body.resourceId).toBe(resource.id);
  });

  it("edits a PENDING PIECE batch, item resource/quantity and relocates units", async () => {
    const batch = await createPieceBatch();
    const item = await addItem(batch.id, {
      resourceId: alphaId,
      warehouseLocationId: locationAId,
      quantity: 5,
    });
    expect(item.statusCode).toBe(201);

    const corrected = await app.inject({
      method: "PATCH",
      url: `/batches/${batch.id}/items/${item.body.id}`,
      ...auth(),
      payload: {
        resourceId: betaId,
        quantity: 7,
        warehouseLocationId: locationBId,
      },
    });
    expect(corrected.statusCode).toBe(200);
    const correctedItem = corrected.json() as BatchItem;
    expect(correctedItem.resourceId).toBe(betaId);
    expect(correctedItem.quantity).toBe(7);
    expect(correctedItem.warehouseLocationId).toBe(locationBId);
    expect(correctedItem.barcode).toBe(item.body.barcode);

    const moved = await patchRegistration(batch.id, {
      warehouseId: otherWarehouseId,
      relocationLocationId: otherLocationId,
    });
    expect(moved.statusCode).toBe(200);
    expect(moved.body.id).toBe(batch.id);
    expect(moved.body.receivingMode).toBe("PIECE");
    expect(moved.body.warehouseId).toBe(otherWarehouseId);
    const movedItem = moved.body.items.find((row) => row.id === item.body.id)!;
    expect(movedItem.warehouseLocationId).toBe(otherLocationId);
    expect(movedItem.barcode).toBe(item.body.barcode);

    const weightResourceOnPiece = await patchRegistration(batch.id, {
      resourceId: alphaId,
    });
    expect(weightResourceOnPiece.statusCode).toBe(400);
    expect(
      (weightResourceOnPiece.body as unknown as { code: string }).code,
    ).toBe("BATCH_NOT_WEIGHT");
  });

  it("rejects PIECE registration/content edits after confirmation", async () => {
    const batch = await createPieceBatch();
    const item = await addItem(batch.id, {
      resourceId: alphaId,
      warehouseLocationId: locationAId,
      quantity: 5,
    });
    const confirm = await app.inject({
      method: "POST",
      url: `/batches/${batch.id}/confirm-piece`,
      cookies: { [AUTH_COOKIE_NAME]: adminCookie },
      payload: {
        acquisitionAmount: "50.00",
        products: [{ resourceId: alphaId, documentPieces: 5 }],
      },
    });
    expect(confirm.statusCode).toBe(200);

    const registration = await patchRegistration(batch.id, {
      warehouseId: otherWarehouseId,
    });
    expect(registration.statusCode).toBe(409);
    expect((registration.body as unknown as { code: string }).code).toBe(
      "BATCH_CONFIRMED",
    );

    const added = await addItem(batch.id, {
      resourceId: betaId,
      warehouseLocationId: locationAId,
      quantity: 1,
    });
    expect(added.statusCode).toBe(409);
    expect((added.body as unknown as { code: string }).code).toBe(
      "BATCH_CONFIRMED",
    );

    const updated = await app.inject({
      method: "PATCH",
      url: `/batches/${batch.id}/items/${item.body.id}`,
      ...auth(),
      payload: { quantity: 6 },
    });
    expect(updated.statusCode).toBe(409);
    expect((updated.json() as { code: string }).code).toBe("BATCH_CONFIRMED");

    const voided = await app.inject({
      method: "POST",
      url: `/batches/${batch.id}/items/${item.body.id}/void`,
      ...auth(),
      payload: {},
    });
    expect(voided.statusCode).toBe(409);
    expect((voided.json() as { code: string }).code).toBe("BATCH_CONFIRMED");
  });
});
