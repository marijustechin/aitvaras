import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type {
  Bag,
  Batch,
  BatchDetail,
  BatchReconciliation,
  IncomingDelivery,
  IncomingDeliveryDetail,
  RoleKey,
} from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { hashPassword } from "../src/modules/auth/password";
import { ean13CheckDigit } from "../src/modules/batches/bag-barcode";
import { deliveryCodePrefix } from "../src/modules/batches/delivery-code";
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

function currentMonthPrefix(): string {
  const now = new Date();
  return deliveryCodePrefix(now.getFullYear(), now.getMonth() + 1);
}

describe.skipIf(!dbAvailable)(
  "Incoming deliveries, batches and packages (integration)",
  () => {
    let app: NestFastifyApplication;
    let prisma: PrismaService;
    let cookie: string;
    let accountingCookie: string;
    let adminCookie: string;
    let workerId: string;

    let supplierId: string;
    let buyerOnlyId: string;
    let inactiveSupplierId: string;
    let activeResourceId: string;
    let activeResource2Id: string;
    let inactiveResourceId: string;

    let warehouseAId: string;
    let warehouseBId: string;
    let inactiveWarehouseId: string;
    let locationA1Id: string;
    let locationA2Id: string;
    let locationB1Id: string;
    let inactiveLocationId: string;

    let packagingZeroId: string;
    let packagingTareId: string;
    let packagingSnapId: string;
    let inactivePackagingId: string;

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
      workerId = (
        await prisma.user.findUniqueOrThrow({
          where: { username: `${PREFIX}worker` },
        })
      ).id;

      supplierId = await seedPartner("supplier", ["SUPPLIER"]);
      buyerOnlyId = await seedPartner("buyer", ["BUYER"]);
      inactiveSupplierId = await seedPartner(
        "inactive-supplier",
        ["SUPPLIER"],
        false,
      );

      activeResourceId = await seedResource("active", true);
      activeResource2Id = await seedResource("active-2", true);
      inactiveResourceId = await seedResource("inactive", false);

      warehouseAId = await seedWarehouse("warehouse-a", true);
      warehouseBId = await seedWarehouse("warehouse-b", true);
      inactiveWarehouseId = await seedWarehouse("inactive-warehouse", false);
      locationA1Id = await seedLocation(warehouseAId, "a1", true);
      locationA2Id = await seedLocation(warehouseAId, "a2", true);
      locationB1Id = await seedLocation(warehouseBId, "b1", true);
      inactiveLocationId = await seedLocation(warehouseAId, "inactive", false);

      packagingZeroId = await seedPackagingType("tara-zero", "0.000", true);
      packagingTareId = await seedPackagingType("tara-epal", "27.000", true);
      packagingSnapId = await seedPackagingType("tara-snap", "10.000", true);
      inactivePackagingId = await seedPackagingType(
        "tara-inactive",
        "5.000",
        false,
      );
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
        where: {
          bag: { batch: { resource: { name: { startsWith: PREFIX } } } },
        },
      });
      await prisma.bag.deleteMany({
        where: { batch: { resource: { name: { startsWith: PREFIX } } } },
      });
      await prisma.receivingDiscrepancy.deleteMany({
        where: { batch: { resource: { name: { startsWith: PREFIX } } } },
      });
      await prisma.batch.deleteMany({
        where: { resource: { name: { startsWith: PREFIX } } },
      });
      await prisma.packagingType.deleteMany({
        where: { name: { startsWith: PREFIX } },
      });
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
      await prisma.resource.deleteMany({
        where: { name: { startsWith: PREFIX } },
      });
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

    async function seedResource(
      suffix: string,
      active: boolean,
    ): Promise<string> {
      const category = await prisma.resourceCategory.findFirstOrThrow({
        where: { name: "Žaliava" },
      });
      const resource = await prisma.resource.create({
        data: { name: `${PREFIX}${suffix}`, categoryId: category.id, active },
      });
      return resource.id;
    }

    async function seedWarehouse(
      suffix: string,
      active: boolean,
    ): Promise<string> {
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

    async function seedPackagingType(
      suffix: string,
      tareWeightKg: string,
      active: boolean,
    ): Promise<string> {
      const type = await prisma.packagingType.create({
        data: { name: `${PREFIX}${suffix}`, tareWeightKg, active },
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

    function auth(): { cookies: Record<string, string> } {
      return { cookies: { [AUTH_COOKIE_NAME]: cookie } };
    }

    function deliveryPayload(overrides: Record<string, unknown> = {}) {
      return { supplierId, arrivalDate: ARRIVAL, ...overrides };
    }

    async function createDelivery(
      payload: Record<string, unknown>,
      asCookie = cookie,
    ): Promise<{ statusCode: number; body: unknown }> {
      const res = await app.inject({
        method: "POST",
        url: "/deliveries",
        cookies: { [AUTH_COOKIE_NAME]: asCookie },
        payload,
      });
      return { statusCode: res.statusCode, body: res.json() };
    }

    async function createDeliveryOk(
      overrides: Record<string, unknown> = {},
    ): Promise<IncomingDelivery> {
      const { statusCode, body } = await createDelivery(
        deliveryPayload(overrides),
      );
      expect(statusCode).toBe(201);
      return body as IncomingDelivery;
    }

    async function resolveBatch(
      deliveryId: string,
      payload: Record<string, unknown>,
    ): Promise<{ statusCode: number; body: unknown }> {
      const res = await app.inject({
        method: "POST",
        url: `/deliveries/${deliveryId}/batches`,
        ...auth(),
        payload,
      });
      return { statusCode: res.statusCode, body: res.json() };
    }

    async function resolveBatchOk(
      deliveryId: string,
      overrides: Record<string, unknown> = {},
    ): Promise<BatchDetail> {
      const { statusCode, body } = await resolveBatch(deliveryId, {
        resourceId: activeResourceId,
        warehouseId: warehouseAId,
        ...overrides,
      });
      expect(statusCode).toBe(201);
      return body as BatchDetail;
    }

    /** A delivery with one batch (default resource/warehouse) for batch tests. */
    async function createBatchOk(overrides: {
      resourceId?: string;
      warehouseId?: string;
      supplierId?: string;
      arrivalDate?: string;
    } = {}): Promise<Batch> {
      const { resourceId, warehouseId, ...deliveryOverrides } = overrides;
      const delivery = await createDeliveryOk(deliveryOverrides);
      const batchOverrides: Record<string, unknown> = {};
      if (resourceId !== undefined) {
        batchOverrides.resourceId = resourceId;
      }
      if (warehouseId !== undefined) {
        batchOverrides.warehouseId = warehouseId;
      }
      return resolveBatchOk(delivery.id, batchOverrides);
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
        packagingTypeId: packagingZeroId,
        grossWeight: "1",
        warehouseLocationId: locationA1Id,
        ...overrides,
      };
    }

    async function createBatchWithBags(
      weights: string[],
      opts: { resourceId?: string; warehouseId?: string } = {},
    ): Promise<Batch> {
      const batch = await createBatchOk({
        resourceId: opts.resourceId,
        warehouseId: opts.warehouseId,
      });
      for (const weight of weights) {
        const result = await addBag(batch.id, bagPayload({ grossWeight: weight }));
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

    async function getDeliveryDetail(
      deliveryId: string,
    ): Promise<IncomingDeliveryDetail> {
      const res = await app.inject({
        method: "GET",
        url: `/deliveries/${deliveryId}`,
        ...auth(),
      });
      expect(res.statusCode).toBe(200);
      return res.json() as IncomingDeliveryDetail;
    }

    // ── Delivery creation ─────────────────────────────────────────────────

    it("rejects unauthenticated requests", async () => {
      expect(
        (await app.inject({ method: "GET", url: "/batches" })).statusCode,
      ).toBe(401);
      expect(
        (await app.inject({ method: "GET", url: "/deliveries" })).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/deliveries",
            payload: deliveryPayload(),
          })
        ).statusCode,
      ).toBe(401);
    });

    it("forbids non-warehouse roles from creating a delivery or batch", async () => {
      const delivery = await app.inject({
        method: "POST",
        url: "/deliveries",
        cookies: { [AUTH_COOKIE_NAME]: accountingCookie },
        payload: deliveryPayload(),
      });
      expect(delivery.statusCode).toBe(403);

      const deliveryOk = await createDeliveryOk();
      const batch = await app.inject({
        method: "POST",
        url: `/deliveries/${deliveryOk.id}/batches`,
        cookies: { [AUTH_COOKIE_NAME]: accountingCookie },
        payload: { resourceId: activeResourceId, warehouseId: warehouseAId },
      });
      expect(batch.statusCode).toBe(403);
    });

    it("creates a delivery with a GYYMM-NN code, one supplier and no warehouse", async () => {
      const delivery = await createDeliveryOk();
      expect(delivery.code).toMatch(/^G\d{4}-\d{2}$/);
      expect(delivery.code.startsWith(currentMonthPrefix())).toBe(true);
      expect(delivery.batchCount).toBe(0);
      expect(delivery.pendingBatchCount).toBe(0);
      expect(delivery.supplierName).toBe(`${PREFIX}supplier`);
      expect(delivery.arrivalDate).toBe(ARRIVAL);
      expect(delivery.createdByName).toBe("Seed worker");
      expect("warehouseId" in delivery).toBe(false);
      expect("warehouseName" in delivery).toBe(false);
    });

    it("assigns a monthly sequence and unique delivery codes", async () => {
      const first = await createDeliveryOk();
      const second = await createDeliveryOk();
      expect(first.code).not.toBe(second.code);
      const firstSeq = Number(first.code.slice(-2));
      const secondSeq = Number(second.code.slice(-2));
      expect(secondSeq).toBe(firstSeq + 1);
    });

    it("rejects a new delivery once the monthly sequence is exhausted (99)", async () => {
      const prefix = currentMonthPrefix();
      await prisma.incomingDelivery.create({
        data: {
          code: `${prefix}99`,
          supplierId,
          arrivalDate: new Date(ARRIVAL),
          createdById: workerId,
        },
      });
      const result = await createDelivery(deliveryPayload());
      expect(result.statusCode).toBe(409);
      expect((result.body as { code: string }).code).toBe(
        "DELIVERY_CODE_EXHAUSTED",
      );
      await prisma.incomingDelivery.deleteMany({
        where: { code: `${prefix}99` },
      });
    });

    it("rejects ineligible supplier and invalid delivery payloads", async () => {
      for (const payload of [
        deliveryPayload({ supplierId: buyerOnlyId }),
        deliveryPayload({ supplierId: inactiveSupplierId }),
        deliveryPayload({ supplierId: MISSING_UUID }),
        deliveryPayload({ supplierId: undefined }),
        deliveryPayload({ supplierId: "not-a-uuid" }),
        deliveryPayload({ arrivalDate: "2026-09-29" }),
        deliveryPayload({ code: "G2609-99" }),
        deliveryPayload({ warehouseId: warehouseAId }),
      ]) {
        expect(
          (await createDelivery(payload)).statusCode,
          JSON.stringify(payload),
        ).toBe(400);
      }
    });

    // ── Batch resolution within a delivery ────────────────────────────────

    it("creates a pending batch with an internal code, warehouse and zero totals", async () => {
      const batch = await createBatchOk();
      expect(batch.code).toMatch(/^P\d{2}$/);
      expect(batch.code).toBe("P01");
      expect(batch.deliveryCode).toMatch(/^G\d{4}-\d{2}$/);
      expect(batch.status).toBe("PENDING");
      expect(batch.bagCount).toBe(0);
      expect(batch.totalNetWeight).toBe("0");
      expect(batch.resourceName).toBe(`${PREFIX}active`);
      expect(batch.supplierName).toBe(`${PREFIX}supplier`);
      expect(batch.warehouseName).toBe(`${PREFIX}warehouse-a`);
      expect(batch.documentPieces).toBeNull();
      expect("unit" in batch).toBe(false);
    });

    it("resolves the same (delivery, resource, warehouse) batch and splits per warehouse", async () => {
      const delivery = await createDeliveryOk();
      const a = await resolveBatchOk(delivery.id, {
        resourceId: activeResourceId,
        warehouseId: warehouseAId,
      });
      const aAgain = await resolveBatchOk(delivery.id, {
        resourceId: activeResourceId,
        warehouseId: warehouseAId,
      });
      expect(aAgain.id).toBe(a.id);

      // Same resource, different warehouse -> its own internal batch.
      const b = await resolveBatchOk(delivery.id, {
        resourceId: activeResourceId,
        warehouseId: warehouseBId,
      });
      expect(b.id).not.toBe(a.id);
      expect(b.warehouseId).toBe(warehouseBId);
      expect(b.deliveryId).toBe(delivery.id);
      expect(a.deliveryId).toBe(delivery.id);
    });

    it("numbers batch codes delivery-locally (P01, P02) and resets per delivery", async () => {
      const delivery = await createDeliveryOk();
      const first = await resolveBatchOk(delivery.id, {
        resourceId: activeResourceId,
        warehouseId: warehouseAId,
      });
      expect(first.code).toBe("P01");
      const second = await resolveBatchOk(delivery.id, {
        resourceId: activeResource2Id,
        warehouseId: warehouseAId,
      });
      expect(second.code).toBe("P02");

      // A different delivery restarts at P01; the same code may coexist.
      const other = await createDeliveryOk();
      const otherFirst = await resolveBatchOk(other.id, {
        resourceId: activeResourceId,
        warehouseId: warehouseAId,
      });
      expect(otherFirst.code).toBe("P01");
      expect(otherFirst.id).not.toBe(first.id);
    });

    it("rejects a duplicate delivery-local code and overflow past P99", async () => {
      const delivery = await createDeliveryOk();
      const first = await resolveBatchOk(delivery.id, {
        resourceId: activeResourceId,
        warehouseId: warehouseAId,
      });
      expect(first.code).toBe("P01");

      // The (deliveryId, code) unique constraint rejects a duplicate.
      await expect(
        prisma.batch.create({
          data: {
            code: "P01",
            deliveryId: delivery.id,
            resourceId: activeResource2Id,
            warehouseId: warehouseAId,
            createdById: workerId,
          },
        }),
      ).rejects.toThrow();

      // Overflow: P99 exists, so resolving a new batch exceeds the cap.
      const overflowDelivery = await createDeliveryOk();
      await prisma.batch.create({
        data: {
          code: "P99",
          deliveryId: overflowDelivery.id,
          resourceId: activeResource2Id,
          warehouseId: warehouseAId,
          createdById: workerId,
        },
      });
      const overflow = await resolveBatch(overflowDelivery.id, {
        resourceId: activeResourceId,
        warehouseId: warehouseAId,
      });
      expect(overflow.statusCode).toBe(409);
      expect((overflow.body as { code: string }).code).toBe(
        "BATCH_CODE_EXHAUSTED",
      );
    });

    it("rejects an ineligible resource or warehouse when resolving a batch", async () => {
      const delivery = await createDeliveryOk();
      for (const payload of [
        { resourceId: inactiveResourceId, warehouseId: warehouseAId },
        { resourceId: MISSING_UUID, warehouseId: warehouseAId },
        { resourceId: activeResourceId, warehouseId: inactiveWarehouseId },
        { resourceId: activeResourceId, warehouseId: MISSING_UUID },
      ]) {
        expect(
          (await resolveBatch(delivery.id, payload)).statusCode,
          JSON.stringify(payload),
        ).toBe(400);
      }
      expect(
        (
          await resolveBatch(MISSING_UUID, {
            resourceId: activeResourceId,
            warehouseId: warehouseAId,
          })
        ).statusCode,
      ).toBe(404);
    });

    it("rejects invalid batch-resolution payloads", async () => {
      const delivery = await createDeliveryOk();
      for (const payload of [
        { resourceId: "not-a-uuid", warehouseId: warehouseAId },
        { resourceId: activeResourceId },
        { resourceId: activeResourceId, warehouseId: "not-a-uuid" },
        { resourceId: activeResourceId, warehouseId: warehouseAId, unit: "KG" },
      ]) {
        expect(
          (await resolveBatch(delivery.id, payload)).statusCode,
          JSON.stringify(payload),
        ).toBe(400);
      }
    });

    // ── Multi-resource / multi-warehouse delivery ─────────────────────────

    it("holds multiple resource batches across different warehouses", async () => {
      const delivery = await createDeliveryOk();
      const a1 = await resolveBatchOk(delivery.id, {
        resourceId: activeResourceId,
        warehouseId: warehouseAId,
      });
      const a2 = await resolveBatchOk(delivery.id, {
        resourceId: activeResourceId,
        warehouseId: warehouseBId,
      });
      const b1 = await resolveBatchOk(delivery.id, {
        resourceId: activeResource2Id,
        warehouseId: warehouseAId,
      });

      expect(
        (
          await addBag(
            a1.id,
            bagPayload({ grossWeight: "12.5", warehouseLocationId: locationA1Id }),
          )
        ).statusCode,
      ).toBe(201);
      expect(
        (
          await addBag(
            a2.id,
            bagPayload({ grossWeight: "8", warehouseLocationId: locationB1Id }),
          )
        ).statusCode,
      ).toBe(201);

      const detail = await getDeliveryDetail(delivery.id);
      expect(detail.batchCount).toBe(3);
      expect(detail.pendingBatchCount).toBe(3);
      expect(detail.batches).toHaveLength(3);
      for (const batch of detail.batches) {
        expect(batch.deliveryId).toBe(delivery.id);
        expect(batch.supplierName).toBe(`${PREFIX}supplier`);
      }
      expect(detail.batches.find((x) => x.id === a1.id)?.warehouseName).toBe(
        `${PREFIX}warehouse-a`,
      );
      expect(detail.batches.find((x) => x.id === a2.id)?.warehouseName).toBe(
        `${PREFIX}warehouse-b`,
      );
      expect(detail.batches.find((x) => x.id === b1.id)?.resourceName).toBe(
        `${PREFIX}active-2`,
      );

      // Per-package locations belong to each batch's warehouse.
      expect((await getDetail(a1.id)).bags[0]?.warehouseLocationId).toBe(
        locationA1Id,
      );
      expect((await getDetail(a2.id)).bags[0]?.warehouseLocationId).toBe(
        locationB1Id,
      );
    });

    it("lists deliveries newest first with batch counts", async () => {
      const delivery = await createDeliveryOk();
      await resolveBatchOk(delivery.id, {
        resourceId: activeResourceId,
        warehouseId: warehouseAId,
      });
      const res = await app.inject({
        method: "GET",
        url: "/deliveries",
        ...auth(),
      });
      expect(res.statusCode).toBe(200);
      const list = res.json() as IncomingDelivery[];
      const found = list.find((d) => d.id === delivery.id);
      expect(found?.batchCount).toBe(1);
      expect(found?.pendingBatchCount).toBe(1);
    });

    it("derives pendingBatchCount from the child batches (not stored)", async () => {
      const delivery = await createDeliveryOk();
      const batch = await resolveBatchOk(delivery.id, {
        resourceId: activeResourceId,
        warehouseId: warehouseAId,
      });
      expect(
        (await addBag(batch.id, bagPayload({ grossWeight: "12.5" }))).statusCode,
      ).toBe(201);

      const listDeliveries = async (): Promise<IncomingDelivery[]> => {
        const res = await app.inject({
          method: "GET",
          url: "/deliveries",
          ...auth(),
        });
        expect(res.statusCode).toBe(200);
        return res.json() as IncomingDelivery[];
      };

      let found = (await listDeliveries()).find((d) => d.id === delivery.id);
      expect(found?.batchCount).toBe(1);
      expect(found?.pendingBatchCount).toBe(1);

      await reconcile(batch.id, {
        documentWeight: "13",
        acquisitionAmount: "0",
        acknowledgeDiscrepancy: true,
      });

      found = (await listDeliveries()).find((d) => d.id === delivery.id);
      expect(found?.batchCount).toBe(1);
      expect(found?.pendingBatchCount).toBe(0);
    });

    // ── Packages ──────────────────────────────────────────────────────────

    it("generates unique, valid EAN-13 barcodes and derives the measured weight", async () => {
      const batch = await createBatchOk();
      const first = await addBag(batch.id, bagPayload({ grossWeight: "12.5" }));
      expect(first.statusCode).toBe(201);
      const bagOne = first.body as Bag;
      expect(isEan13(bagOne.barcode)).toBe(true);
      expect(bagOne.batchCode).toBe(batch.code);
      expect(bagOne.grossWeight).toBe("12.5");
      expect(bagOne.warehouseLocationId).toBe(locationA1Id);

      const second = await addBag(
        batch.id,
        bagPayload({ grossWeight: "7.25", warehouseLocationId: locationA2Id }),
      );
      expect(second.statusCode).toBe(201);
      expect((second.body as Bag).barcode).not.toBe(bagOne.barcode);

      const body = await getDetail(batch.id);
      expect(body.bagCount).toBe(2);
      expect(body.totalNetWeight).toBe("19.75");
      expect(body.bags).toHaveLength(2);
      expect(body.suggestedLocationId).toBe(locationA2Id);
    });

    it("looks up a package by barcode and 404s for unknown codes", async () => {
      const batch = await createBatchOk();
      const bag = (await addBag(batch.id, bagPayload({ grossWeight: "3" })))
        .body as Bag;
      const found = await app.inject({
        method: "GET",
        url: `/bags/by-barcode/${bag.barcode}`,
        ...auth(),
      });
      expect(found.statusCode).toBe(200);
      expect((found.json() as Bag).id).toBe(bag.id);

      expect(
        (
          await app.inject({
            method: "GET",
            url: "/bags/by-barcode/0000000000000",
            ...auth(),
          })
        ).statusCode,
      ).toBe(404);
    });

    it("rejects a package location outside the batch warehouse", async () => {
      const batch = await createBatchOk();
      expect(
        (
          await addBag(
            batch.id,
            bagPayload({ grossWeight: "1", warehouseLocationId: locationB1Id }),
          )
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await addBag(
            batch.id,
            bagPayload({ grossWeight: "1", warehouseLocationId: inactiveLocationId }),
          )
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await addBag(
            batch.id,
            bagPayload({ grossWeight: "1", warehouseLocationId: MISSING_UUID }),
          )
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await addBag(
            batch.id,
            bagPayload({ grossWeight: "1", warehouseLocationId: undefined }),
          )
        ).statusCode,
      ).toBe(400);
    });

    it("rejects invalid package weights and unknown fields (no unit)", async () => {
      const batch = await createBatchOk();
      for (const weight of ["0", "-1", "abc", ""]) {
        expect(
          (await addBag(batch.id, bagPayload({ grossWeight: weight }))).statusCode,
          weight,
        ).toBe(400);
      }
      expect(
        (await addBag(batch.id, bagPayload({ grossWeight: "1", unit: "PCS" }))).statusCode,
      ).toBe(400);
      expect(
        (await addBag(batch.id, bagPayload({ grossWeight: "1", barcode: "123" })))
          .statusCode,
      ).toBe(400);
    });

    it("exposes the resource category and last-used location on the detail", async () => {
      const batch = await createBatchOk();
      await addBag(batch.id, bagPayload({ grossWeight: "10" }));
      const body = await getDetail(batch.id);
      expect(body.resourceCategoryName).toBe("Žaliava");
      expect(body.suggestedLocationId).toBe(locationA1Id);
      expect(body.bags[0]?.warehouseLocationId).toBe(locationA1Id);
      expect(body.bags[0]?.warehouseLocationName).toBe(`${PREFIX}a1`);
    });

    it("allows adding a package to a pending batch but not a confirmed one", async () => {
      const batch = await createBatchOk();
      await addBag(batch.id, bagPayload({ grossWeight: "1" }));
      await prisma.batch.update({
        where: { id: batch.id },
        data: { status: "CONFIRMED" },
      });
      const result = await addBag(batch.id, bagPayload({ grossWeight: "1" }));
      expect(result.statusCode).toBe(400);
      expect((result.body as { code: string }).code).toBe("BATCH_CONFIRMED");
    });

    it("filters the batch list by status and rejects an unknown status", async () => {
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
        (
          await app.inject({
            method: "GET",
            url: "/batches?status=NOPE",
            ...auth(),
          })
        ).statusCode,
      ).toBe(400);
    });

    it("returns 404/400 for bad batch and delivery ids", async () => {
      expect(
        (
          await app.inject({
            method: "GET",
            url: `/batches/${MISSING_UUID}`,
            ...auth(),
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/batches/not-a-uuid",
            ...auth(),
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (await addBag(MISSING_UUID, bagPayload({ grossWeight: "1" }))).statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: "GET",
            url: `/deliveries/${MISSING_UUID}`,
            ...auth(),
          })
        ).statusCode,
      ).toBe(404);
    });

    // ── Reconciliation ────────────────────────────────────────────────────

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
      expect(summary.discrepancyId).toBeNull();
      expect(summary.documentPieces).toBeNull();
      expect(summary.confirmedAt).not.toBeNull();
      expect(
        await prisma.receivingDiscrepancy.count({ where: { batchId: batch.id } }),
      ).toBe(0);
      expect((await getDetail(batch.id)).hasOpenDiscrepancy).toBe(false);

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
      const summary = result.body as BatchReconciliation;
      expect(summary.receiptLineId).toBe(seeded.lineId);
      expect(summary.receiptId).toBe(seeded.receiptId);
    });

    it("stores an optional documentary piece count and confirms a mismatch with acknowledgement", async () => {
      const batch = await createBatchWithBags(["186.4"]);
      const result = await reconcile(batch.id, {
        documentWeight: "188",
        acquisitionAmount: "100",
        documentPieces: 500,
        acknowledgeDiscrepancy: true,
      });
      expect(result.statusCode).toBe(200);
      const summary = result.body as BatchReconciliation;
      expect(summary.status).toBe("CONFIRMED");
      expect(summary.measuredWeight).toBe("186.4");
      expect(summary.documentPieces).toBe(500);
      expect(summary.difference).toBe("-1.6");
      expect(summary.discrepancyId).toBeTruthy();

      const body = await getDetail(batch.id);
      expect(body.status).toBe("CONFIRMED");
      expect(body.hasOpenDiscrepancy).toBe(true);
      expect(body.discrepancies).toHaveLength(1);
      expect(body.discrepancies[0]?.status).toBe("OPEN");
      expect(body.documentPieces).toBe(500);
      expect(body.totalNetWeight).toBe("186.4");
    });

    it("rejects an invalid documentary piece count", async () => {
      const batch = await createBatchWithBags(["1"]);
      for (const documentPieces of [0, -1, 2.5, "500"]) {
        expect(
          (
            await reconcile(batch.id, {
              documentWeight: "1",
              acquisitionAmount: "1",
              documentPieces,
            })
          ).statusCode,
          String(documentPieces),
        ).toBe(400);
      }
    });

    it("requires explicit acknowledgement before confirming a mismatch", async () => {
      const batch = await createBatchWithBags(["12.75"]);
      const rejected = await reconcile(batch.id, {
        documentWeight: "13",
        acquisitionAmount: "0",
      });
      expect(rejected.statusCode).toBe(400);
      expect((rejected.body as { code: string }).code).toBe(
        "DISCREPANCY_NOT_ACKNOWLEDGED",
      );
      // Nothing changed: still PENDING and no discrepancy recorded.
      const before = await getDetail(batch.id);
      expect(before.status).toBe("PENDING");
      expect(before.hasOpenDiscrepancy).toBe(false);
      expect(before.discrepancies).toHaveLength(0);

      const confirmed = await reconcile(batch.id, {
        documentWeight: "13",
        acquisitionAmount: "0",
        acknowledgeDiscrepancy: true,
      });
      expect(confirmed.statusCode).toBe(200);
      const summary = confirmed.body as BatchReconciliation;
      expect(summary.status).toBe("CONFIRMED");
      expect(summary.measuredWeight).toBe("12.75");
      expect(summary.difference).toBe("-0.25");
      expect(summary.discrepancyId).toBeTruthy();

      const detail = await getDetail(batch.id);
      expect(detail.status).toBe("CONFIRMED");
      expect(detail.hasOpenDiscrepancy).toBe(true);
      expect(detail.discrepancies).toHaveLength(1);
      const disc = detail.discrepancies[0]!;
      expect(disc.status).toBe("OPEN");
      expect(disc.measuredWeight).toBe("12.75");
      expect(disc.documentWeight).toBe("13");
      expect(disc.differenceWeight).toBe("-0.25");
      expect(disc.supplierId).toBe(supplierId);
      // The physical stock remains the measured net weight.
      expect(detail.totalNetWeight).toBe("12.75");
    });

    it("uses the measured − document sign convention", async () => {
      const over = await createBatchWithBags(["199.2"]);
      const overResult = (
        await reconcile(over.id, {
          documentWeight: "180",
          acquisitionAmount: "1",
          acknowledgeDiscrepancy: true,
        })
      ).body as BatchReconciliation;
      expect(overResult.difference).toBe("19.2");
      expect(overResult.discrepancyId).toBeTruthy();

      const under = await createBatchWithBags(["170"]);
      const underResult = (
        await reconcile(under.id, {
          documentWeight: "180",
          acquisitionAmount: "1",
          acknowledgeDiscrepancy: true,
        })
      ).body as BatchReconciliation;
      expect(underResult.difference).toBe("-10");
    });

    it("confirms a mismatch once and does not create a duplicate discrepancy on retry", async () => {
      const batch = await createBatchWithBags(["4.5"]);
      const first = await reconcile(batch.id, {
        documentWeight: "5",
        acquisitionAmount: "10",
        acknowledgeDiscrepancy: true,
      });
      const firstSummary = first.body as BatchReconciliation;
      expect(firstSummary.status).toBe("CONFIRMED");
      expect(firstSummary.difference).toBe("-0.5");
      expect(
        await prisma.receivingDiscrepancy.count({ where: { batchId: batch.id } }),
      ).toBe(1);

      const retry = await reconcile(batch.id, {
        documentWeight: "5",
        acquisitionAmount: "10",
        acknowledgeDiscrepancy: true,
      });
      expect(retry.statusCode).toBe(409);
      expect((retry.body as { code: string }).code).toBe(
        "BATCH_ALREADY_CONFIRMED",
      );
      expect(
        await prisma.receivingDiscrepancy.count({ where: { batchId: batch.id } }),
      ).toBe(1);
    });

    it("creates no new packages and does not duplicate weight", async () => {
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
    });

    it("rejects reconciling an empty batch and non-admin/unknown cases", async () => {
      const empty = await createBatchOk();
      const emptyResult = await reconcile(empty.id, {
        documentWeight: "1",
        acquisitionAmount: "1",
      });
      expect(emptyResult.statusCode).toBe(400);
      expect((emptyResult.body as { code: string }).code).toBe("BATCH_EMPTY");

      const batch = await createBatchWithBags(["1"]);
      expect(
        (
          await reconcile(MISSING_UUID, {
            documentWeight: "1",
            acquisitionAmount: "1",
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await reconcile(
            batch.id,
            { documentWeight: "1", acquisitionAmount: "1" },
            false,
          )
        ).statusCode,
      ).toBe(403);
    });

    it("rejects invalid reconciliation payloads", async () => {
      const batch = await createBatchWithBags(["1"]);
      for (const payload of [
        { documentWeight: "0", acquisitionAmount: "1" },
        { documentWeight: "-1", acquisitionAmount: "1" },
        { documentWeight: "1", acquisitionAmount: "-1" },
        { documentWeight: "1", acquisitionAmount: "1", measuredWeight: "1" },
        {
          documentWeight: "1",
          acquisitionAmount: "1",
          receiptLineId: MISSING_UUID,
        },
      ]) {
        expect(
          (await reconcile(batch.id, payload)).statusCode,
          JSON.stringify(payload),
        ).toBe(400);
      }
    });

    it("persists the acquisition value and formal document metadata", async () => {
      const batch = await createBatchWithBags(["6"]);
      await reconcile(batch.id, {
        documentWeight: "6",
        acquisitionAmount: "123.45",
        documentDate: "2026-09-20T00:00:00.000Z",
        documentNumber: "SF-2026-001",
      });
      const body = await getDetail(batch.id);
      expect(Number(body.acquisitionAmount)).toBe(123.45);
      expect(body.documentNumber).toBe("SF-2026-001");
      expect(body.confirmedAt).not.toBeNull();
      expect(body.arrivalDate).toBe(ARRIVAL);
    });

    // ── Corrections / void ────────────────────────────────────────────────

    it("computes net weight server-side from the packaging tare", async () => {
      const batch = await createBatchOk();
      const result = await addBag(
        batch.id,
        bagPayload({
          packagingTypeId: packagingTareId,
          grossWeight: "527.400",
        }),
      );
      expect(result.statusCode).toBe(201);
      const bag = result.body as Bag;
      expect(bag.grossWeight).toBe("527.4");
      expect(Number(bag.tareWeightKg)).toBe(27);
      expect(bag.netWeight).toBe("500.4");
      expect(bag.packagingTypeName).toBe(`${PREFIX}tara-epal`);

      const detail = await getDetail(batch.id);
      expect(detail.totalNetWeight).toBe("500.4");
    });

    it("rejects a gross weight not above the tare", async () => {
      const batch = await createBatchOk();
      for (const grossWeight of ["27.000", "5.000", "0"]) {
        const result = await addBag(
          batch.id,
          bagPayload({ packagingTypeId: packagingTareId, grossWeight }),
        );
        expect(result.statusCode, grossWeight).toBe(400);
      }
      const equal = await addBag(
        batch.id,
        bagPayload({ packagingTypeId: packagingTareId, grossWeight: "27.000" }),
      );
      expect((equal.body as { code: string }).code).toBe("GROSS_NOT_ABOVE_TARE");
    });

    it("rejects an inactive or unknown packaging type for new receiving", async () => {
      const batch = await createBatchOk();
      const inactive = await addBag(
        batch.id,
        bagPayload({ packagingTypeId: inactivePackagingId, grossWeight: "10" }),
      );
      expect(inactive.statusCode).toBe(400);
      expect((inactive.body as { code: string }).code).toBe("PACKAGING_INACTIVE");

      expect(
        (await addBag(batch.id, bagPayload({ packagingTypeId: MISSING_UUID })))
          .statusCode,
      ).toBe(400);
    });

    it("keeps an inactive packaging type readable on historical packages", async () => {
      const batch = await createBatchOk();
      const created = (
        await addBag(
          batch.id,
          bagPayload({ packagingTypeId: packagingTareId, grossWeight: "100" }),
        )
      ).body as Bag;
      // Deactivate the packaging type afterwards; the package stays readable.
      await prisma.packagingType.update({
        where: { id: packagingTareId },
        data: { active: false },
      });
      const bag = (await getDetail(batch.id)).bags.find((x) => x.id === created.id);
      expect(bag?.packagingTypeName).toBe(`${PREFIX}tara-epal`);
      expect(bag?.netWeight).toBe("73");
      await prisma.packagingType.update({
        where: { id: packagingTareId },
        data: { active: true },
      });
    });

    it("suggests the packaging type of the latest active package, not a voided one", async () => {
      const batch = await createBatchOk();
      // A brand-new batch suggests nothing.
      expect((await getDetail(batch.id)).suggestedPackagingTypeId).toBeNull();

      const first = (
        await addBag(
          batch.id,
          bagPayload({ packagingTypeId: packagingZeroId, grossWeight: "5" }),
        )
      ).body as Bag;
      expect((await getDetail(batch.id)).suggestedPackagingTypeId).toBe(
        packagingZeroId,
      );

      const second = (
        await addBag(
          batch.id,
          bagPayload({ packagingTypeId: packagingTareId, grossWeight: "100" }),
        )
      ).body as Bag;
      expect((await getDetail(batch.id)).suggestedPackagingTypeId).toBe(
        packagingTareId,
      );

      // A voided latest package is not suggested; the previous active one is.
      await voidBag(batch.id, second.id);
      const detail = await getDetail(batch.id);
      expect(detail.suggestedPackagingTypeId).toBe(packagingZeroId);
      expect(detail.suggestedPackagingTypeId).toBe(first.packagingTypeId);
    });

    it("does not carry the packaging type into a different batch of the same delivery", async () => {
      const delivery = await createDeliveryOk();
      const batchA = await resolveBatchOk(delivery.id, {
        resourceId: activeResourceId,
        warehouseId: warehouseAId,
      });
      await addBag(
        batchA.id,
        bagPayload({ packagingTypeId: packagingTareId, grossWeight: "100" }),
      );
      expect((await getDetail(batchA.id)).suggestedPackagingTypeId).toBe(
        packagingTareId,
      );

      // "Kitas išteklius": a new batch in the same delivery starts without one.
      const batchB = await resolveBatchOk(delivery.id, {
        resourceId: activeResource2Id,
        warehouseId: warehouseAId,
      });
      expect((await getDetail(batchB.id)).suggestedPackagingTypeId).toBeNull();
    });

    it("corrects a package gross weight and packaging with an auditable trail", async () => {
      const batch = await createBatchOk();
      const created = (
        await addBag(batch.id, bagPayload({ grossWeight: "12.5" }))
      ).body as Bag;

      const gross = await patchBag(batch.id, created.id, { grossWeight: "15" });
      expect(gross.statusCode).toBe(200);
      expect((gross.body as Bag).grossWeight).toBe("15");
      expect((gross.body as Bag).netWeight).toBe("15");

      // Switching to a tare-27 packaging recomputes the net weight.
      const packaging = await patchBag(batch.id, created.id, {
        packagingTypeId: packagingTareId,
        grossWeight: "42",
      });
      expect(packaging.statusCode).toBe(200);
      expect((packaging.body as Bag).netWeight).toBe("15");

      const detail = await getDetail(batch.id);
      expect(detail.totalNetWeight).toBe("15");
      expect(detail.corrections.map((c) => c.kind).sort()).toEqual([
        "GROSS_WEIGHT",
        "GROSS_WEIGHT",
        "PACKAGING",
      ]);
      const kinds = detail.corrections.map((c) => c.kind);
      expect(kinds).toContain("PACKAGING");
      expect(kinds).toContain("GROSS_WEIGHT");
    });

    it("snapshots the packaging tare and is immune to later master edits", async () => {
      const batch = await createBatchOk();
      const created = (
        await addBag(
          batch.id,
          bagPayload({ packagingTypeId: packagingSnapId, grossWeight: "110" }),
        )
      ).body as Bag;
      expect(Number(created.tareWeightKg)).toBe(10);
      expect(created.netWeight).toBe("100");

      // The master tare changes: the historical package must not change.
      await prisma.packagingType.update({
        where: { id: packagingSnapId },
        data: { tareWeightKg: "12.000" },
      });
      const relisted =
        (await getDetail(batch.id)).bags.find((b) => b.id === created.id) ?? null;
      expect(Number(relisted?.tareWeightKg)).toBe(10);
      expect(relisted?.netWeight).toBe("100");
      expect(Number(relisted?.grossWeight)).toBe(110);

      // A newly registered package uses the new tare.
      const newer = (
        await addBag(
          batch.id,
          bagPayload({ packagingTypeId: packagingSnapId, grossWeight: "112" }),
        )
      ).body as Bag;
      expect(Number(newer.tareWeightKg)).toBe(12);
      expect(newer.netWeight).toBe("100");

      // Restore the master tare for any later test.
      await prisma.packagingType.update({
        where: { id: packagingSnapId },
        data: { tareWeightKg: "10.000" },
      });
    });

    it("re-snapshots the tare when the packaging type is corrected", async () => {
      const batch = await createBatchOk();
      const created = (
        await addBag(batch.id, bagPayload({ grossWeight: "100" }))
      ).body as Bag;
      expect(Number(created.tareWeightKg)).toBe(0);
      expect(created.netWeight).toBe("100");

      const patched = await patchBag(batch.id, created.id, {
        packagingTypeId: packagingSnapId,
        grossWeight: "110",
      });
      expect(patched.statusCode).toBe(200);
      const updated = patched.body as Bag;
      expect(Number(updated.tareWeightKg)).toBe(10);
      expect(updated.netWeight).toBe("100");

      const detail = await getDetail(batch.id);
      const bag = detail.bags.find((b) => b.id === created.id);
      expect(Number(bag?.tareWeightKg)).toBe(10);
      // gross - snapshot tare = net
      expect(Number(bag!.grossWeight) - Number(bag!.tareWeightKg)).toBe(
        Number(bag!.netWeight),
      );
      const packagingTrail = detail.corrections.find(
        (c) => c.kind === "PACKAGING",
      );
      expect(packagingTrail?.previousValue).toContain("0");
      expect(packagingTrail?.newValue).toContain("10");
    });

    it("treats a no-op correction as unchanged and records no trail", async () => {
      const batch = await createBatchOk();
      const bag = (await addBag(batch.id, bagPayload({ grossWeight: "5" })))
        .body as Bag;
      const same = await patchBag(batch.id, bag.id, {
        grossWeight: "5",
        warehouseLocationId: bag.warehouseLocationId,
      });
      expect(same.statusCode).toBe(200);
      expect(
        await prisma.bagCorrection.count({ where: { bagId: bag.id } }),
      ).toBe(0);
    });

    it("voids a package: preserved and excluded from the measured weight", async () => {
      const batch = await createBatchOk();
      await addBag(batch.id, bagPayload({ grossWeight: "10" }));
      const second = (await addBag(batch.id, bagPayload({ grossWeight: "5" })))
        .body as Bag;

      const result = await voidBag(batch.id, second.id, {
        reason: "Sugedęs maišas",
      });
      expect(result.statusCode).toBe(200);
      const voided = result.body as Bag;
      expect(voided.status).toBe("VOIDED");
      expect(voided.voidReason).toBe("Sugedęs maišas");

      const detail = await getDetail(batch.id);
      expect(detail.bagCount).toBe(1);
      expect(detail.totalNetWeight).toBe("10");
      expect(detail.bags).toHaveLength(2);
      const trail = detail.corrections.find((c) => c.kind === "VOID");
      expect(trail?.previousValue).toBe("5");
    });

    it("rejects correcting or voiding a voided package or a confirmed batch", async () => {
      const batch = await createBatchOk();
      const bag = (await addBag(batch.id, bagPayload({ grossWeight: "5" })))
        .body as Bag;
      expect((await voidBag(batch.id, bag.id)).statusCode).toBe(200);
      const correctVoided = await patchBag(batch.id, bag.id, { grossWeight: "6" });
      expect(correctVoided.statusCode).toBe(400);
      expect((correctVoided.body as { code: string }).code).toBe("BAG_VOIDED");

      const confirmedBatch = await createBatchOk();
      const confirmedBag = (
        await addBag(confirmedBatch.id, bagPayload({ grossWeight: "5" }))
      ).body as Bag;
      await prisma.batch.update({
        where: { id: confirmedBatch.id },
        data: { status: "CONFIRMED" },
      });
      const correctConfirmed = await patchBag(
        confirmedBatch.id,
        confirmedBag.id,
        { grossWeight: "6" },
      );
      expect(correctConfirmed.statusCode).toBe(409);
      expect((correctConfirmed.body as { code: string }).code).toBe(
        "BATCH_CONFIRMED",
      );
    });

    it("validates correction payloads and requires warehouse roles/ids", async () => {
      const batch = await createBatchOk();
      const bag = (await addBag(batch.id, bagPayload({ grossWeight: "5" })))
        .body as Bag;
      for (const payload of [
        {},
        { grossWeight: "0" },
        { grossWeight: "-1" },
        { warehouseLocationId: "not-a-uuid" },
        { warehouseLocationId: locationB1Id },
      ]) {
        expect(
          (await patchBag(batch.id, bag.id, payload)).statusCode,
          JSON.stringify(payload),
        ).toBe(400);
      }
      expect(
        (await voidBag(batch.id, bag.id, { reason: "x".repeat(501) })).statusCode,
      ).toBe(400);

      const asAccounting = await app.inject({
        method: "PATCH",
        url: `/batches/${batch.id}/bags/${bag.id}`,
        cookies: { [AUTH_COOKIE_NAME]: accountingCookie },
        payload: { grossWeight: "7" },
      });
      expect(asAccounting.statusCode).toBe(403);
      expect(
        (await patchBag(MISSING_UUID, bag.id, { grossWeight: "1" })).statusCode,
      ).toBe(404);
    });
  },
);
