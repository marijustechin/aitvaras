import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type {
  DiscrepancySettlement,
  ReceivingDiscrepancyDetail,
  ReceivingDiscrepancyRegisterRow,
  RoleKey,
} from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { hashPassword } from "../src/modules/auth/password";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_discrepancy_";

describe.skipIf(!dbAvailable)("Receiving discrepancies (integration)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let workerCookie: string;
  let adminId: string;

  let supplierId: string;
  let otherSupplierId: string;
  let resourceId: string;
  let warehouseId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await cleanup();
    await seedUser("admin", "admin-password-123", ["ADMIN"]);
    await seedUser("worker", "worker-password-123", ["WAREHOUSE_WORKER"]);
    adminCookie = await login(`${PREFIX}admin`, "admin-password-123");
    workerCookie = await login(`${PREFIX}worker`, "worker-password-123");
    adminId = (
      await prisma.user.findUniqueOrThrow({
        where: { username: `${PREFIX}admin` },
      })
    ).id;

    supplierId = await seedPartner("supplier");
    otherSupplierId = await seedPartner("other-supplier");
    resourceId = await seedResource("resource");
    warehouseId = await seedWarehouse("warehouse");
    await seedLocation(warehouseId);
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
    await prisma.discrepancySettlement.deleteMany({
      where: {
        discrepancy: { batch: { resource: { name: { startsWith: PREFIX } } } },
      },
    });
    await prisma.receivingDiscrepancy.deleteMany({
      where: { batch: { resource: { name: { startsWith: PREFIX } } } },
    });
    await prisma.batch.deleteMany({
      where: { resource: { name: { startsWith: PREFIX } } },
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

  async function seedPartner(suffix: string): Promise<string> {
    const partner = await prisma.businessPartner.create({
      data: {
        name: `${PREFIX}${suffix}`,
        roles: { create: [{ role: "SUPPLIER" }] },
      },
    });
    return partner.id;
  }

  async function seedResource(suffix: string): Promise<string> {
    const category = await prisma.resourceCategory.findFirstOrThrow({
      where: { name: "Žaliava" },
    });
    const resource = await prisma.resource.create({
      data: { name: `${PREFIX}${suffix}`, categoryId: category.id },
    });
    return resource.id;
  }

  async function seedWarehouse(suffix: string): Promise<string> {
    const warehouse = await prisma.warehouse.create({
      data: { name: `${PREFIX}${suffix}` },
    });
    return warehouse.id;
  }

  async function seedLocation(warehouseIdValue: string): Promise<string> {
    const location = await prisma.warehouseLocation.create({
      data: { warehouseId: warehouseIdValue, name: `${PREFIX}loc` },
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

  let sequence = 0;

  /** A confirmed batch for the given supplier (its own delivery). */
  async function seedBatch(
    partnerId: string,
    status: "PENDING" | "CONFIRMED" = "CONFIRMED",
  ): Promise<string> {
    sequence += 1;
    const delivery = await prisma.incomingDelivery.create({
      data: {
        code: `G9901-${String(sequence).padStart(2, "0")}`,
        supplierId: partnerId,
        arrivalDate: new Date("2026-10-01T00:00:00.000Z"),
        createdById: adminId,
      },
    });
    const batch = await prisma.batch.create({
      data: {
        code: `P${String(sequence).padStart(2, "0")}`,
        deliveryId: delivery.id,
        resourceId,
        warehouseId,
        status,
        documentWeight: "1000.000",
        confirmedAt: status === "CONFIRMED" ? new Date() : null,
        createdById: adminId,
      },
    });
    return batch.id;
  }

  /** A discrepancy with a signed difference (measured − document). */
  async function seedDiscrepancy(
    partnerId: string,
    measured: string,
    document: string,
  ): Promise<string> {
    const batchId = await seedBatch(partnerId);
    const difference = Number(measured) - Number(document);
    const discrepancy = await prisma.receivingDiscrepancy.create({
      data: {
        batchId,
        supplierId: partnerId,
        measuredWeight: measured,
        documentWeight: document,
        differenceWeight: String(difference.toFixed(3)),
        createdById: adminId,
      },
    });
    return discrepancy.id;
  }

  function auth(cookieValue = adminCookie): {
    cookies: Record<string, string>;
  } {
    return { cookies: { [AUTH_COOKIE_NAME]: cookieValue } };
  }

  async function listRegister(
    asCookie: string | null = adminCookie,
  ): Promise<{ statusCode: number; body: ReceivingDiscrepancyRegisterRow[] }> {
    const res = await app.inject({
      method: "GET",
      url: "/receiving-discrepancies",
      ...(asCookie ? auth(asCookie) : {}),
    });
    return {
      statusCode: res.statusCode,
      body: res.json() as ReceivingDiscrepancyRegisterRow[],
    };
  }

  async function getDetail(id: string): Promise<ReceivingDiscrepancyDetail> {
    const res = await app.inject({
      method: "GET",
      url: `/receiving-discrepancies/${id}`,
      ...auth(),
    });
    expect(res.statusCode).toBe(200);
    return res.json() as ReceivingDiscrepancyDetail;
  }

  async function postSettlement(
    id: string,
    payload: Record<string, unknown>,
    asCookie: string | null = adminCookie,
  ): Promise<{ statusCode: number; body: unknown }> {
    const res = await app.inject({
      method: "POST",
      url: `/receiving-discrepancies/${id}/settlements`,
      ...(asCookie ? auth(asCookie) : {}),
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() };
  }

  it("requires authentication to read the register", async () => {
    expect((await listRegister(null)).statusCode).toBe(401);
  });

  it("lists an existing discrepancy with a derived balance and direction", async () => {
    const id = await seedDiscrepancy(supplierId, "980.000", "1000.000");
    const { statusCode, body } = await listRegister();
    expect(statusCode).toBe(200);
    const row = body.find((entry) => entry.id === id)!;
    expect(row.differenceWeight).toBe("-20");
    expect(row.direction).toBe("SHORTAGE");
    expect(row.originalWeight).toBe("20");
    expect(row.settledWeight).toBe("0");
    expect(row.remainingWeight).toBe("20");
    expect(row.status).toBe("OPEN");
    expect(row.supplierName).toBe(`${PREFIX}supplier`);
    expect(row.resourceName).toBe(`${PREFIX}resource`);
  });

  it("returns the immutable origin summary and no settlements initially", async () => {
    const id = await seedDiscrepancy(supplierId, "980.000", "1000.000");
    const detail = await getDetail(id);
    expect(detail.measuredWeight).toBe("980");
    expect(detail.documentWeight).toBe("1000");
    expect(detail.differenceWeight).toBe("-20");
    expect(detail.direction).toBe("SHORTAGE");
    expect(detail.settlements).toEqual([]);
    expect(detail.status).toBe("OPEN");
  });

  it("partially and then fully settles a shortened discrepancy by weight", async () => {
    const id = await seedDiscrepancy(supplierId, "980.000", "1000.000");

    const partial = await postSettlement(id, {
      type: "WEIGHT",
      coveredWeightKg: "5",
    });
    expect(partial.statusCode).toBe(201);
    const partialBody = partial.body as DiscrepancySettlement;
    expect(partialBody.coveredWeightKg).toBe("5");
    expect(partialBody.type).toBe("WEIGHT");
    expect(partialBody.moneyAmount).toBeNull();

    let detail = await getDetail(id);
    expect(detail.status).toBe("PARTIALLY_SETTLED");
    expect(detail.settledWeight).toBe("5");
    expect(detail.remainingWeight).toBe("15");
    expect(detail.settledAt).toBeNull();

    const complete = await postSettlement(id, {
      type: "WEIGHT",
      coveredWeightKg: "15",
    });
    expect(complete.statusCode).toBe(201);

    detail = await getDetail(id);
    expect(detail.status).toBe("SETTLED");
    expect(detail.settledWeight).toBe("20");
    expect(detail.remainingWeight).toBe("0");
    expect(detail.settledAt).not.toBeNull();
    expect(detail.settlements).toHaveLength(2);
  });

  it("rejects over-settlement transactionally", async () => {
    const id = await seedDiscrepancy(supplierId, "980.000", "1000.000");
    expect(
      (await postSettlement(id, { type: "WEIGHT", coveredWeightKg: "15" }))
        .statusCode,
    ).toBe(201);
    const over = await postSettlement(id, {
      type: "WEIGHT",
      coveredWeightKg: "10",
    });
    expect(over.statusCode).toBe(409);
    expect((over.body as { code: string }).code).toBe(
      "SETTLEMENT_EXCEEDS_REMAINING",
    );
    const detail = await getDetail(id);
    expect(detail.remainingWeight).toBe("5");
    expect(detail.settlements).toHaveLength(1);
  });

  it("never changes the immutable discrepancy or inventory when settling", async () => {
    const id = await seedDiscrepancy(supplierId, "1020.000", "1000.000");
    const before = await getDetail(id);
    await postSettlement(id, { type: "WEIGHT", coveredWeightKg: "20" });
    const after = await getDetail(id);
    expect(after.measuredWeight).toBe(before.measuredWeight);
    expect(after.documentWeight).toBe(before.documentWeight);
    expect(after.differenceWeight).toBe(before.differenceWeight);
    const batch = await prisma.batch.findUniqueOrThrow({
      where: { id: before.batchId },
    });
    expect(batch.status).toBe("CONFIRMED");
    expect(batch.documentWeight?.toString()).toBe("1000");
  });

  it("settles by money without any money↔kg conversion", async () => {
    const id = await seedDiscrepancy(supplierId, "980.000", "1000.000");
    const missingAmount = await postSettlement(id, {
      type: "MONEY",
      coveredWeightKg: "20",
      currency: "EUR",
    });
    expect(missingAmount.statusCode).toBe(400);

    const missingCurrency = await postSettlement(id, {
      type: "MONEY",
      coveredWeightKg: "20",
      moneyAmount: "45",
    });
    expect(missingCurrency.statusCode).toBe(400);

    const ok = await postSettlement(id, {
      type: "MONEY",
      coveredWeightKg: "20",
      moneyAmount: "45",
      currency: "EUR",
    });
    expect(ok.statusCode).toBe(201);
    const body = ok.body as DiscrepancySettlement;
    expect(body.type).toBe("MONEY");
    expect(body.coveredWeightKg).toBe("20");
    expect(body.moneyAmount).toBe("45");
    expect(body.currency).toBe("EUR");

    const detail = await getDetail(id);
    expect(detail.status).toBe("SETTLED");
    expect(detail.remainingWeight).toBe("0");
  });

  it("rejects money fields on a weight settlement", async () => {
    const id = await seedDiscrepancy(supplierId, "980.000", "1000.000");
    const res = await postSettlement(id, {
      type: "WEIGHT",
      coveredWeightKg: "5",
      moneyAmount: "10",
    });
    expect(res.statusCode).toBe(400);
  });

  it("validates an optional source batch (confirmed + same supplier)", async () => {
    const id = await seedDiscrepancy(supplierId, "980.000", "1000.000");
    const sameSupplier = await seedBatch(supplierId, "CONFIRMED");
    const otherSupplier = await seedBatch(otherSupplierId, "CONFIRMED");
    const pending = await seedBatch(supplierId, "PENDING");

    const linked = await postSettlement(id, {
      type: "WEIGHT",
      coveredWeightKg: "5",
      sourceBatchId: sameSupplier,
    });
    expect(linked.statusCode).toBe(201);
    expect((linked.body as DiscrepancySettlement).sourceBatchCode).toBeTruthy();

    const badPending = await postSettlement(id, {
      type: "WEIGHT",
      coveredWeightKg: "5",
      sourceBatchId: pending,
    });
    expect(badPending.statusCode).toBe(400);
    expect((badPending.body as { code: string }).code).toBe(
      "SOURCE_BATCH_NOT_CONFIRMED",
    );

    const badSupplier = await postSettlement(id, {
      type: "WEIGHT",
      coveredWeightKg: "5",
      sourceBatchId: otherSupplier,
    });
    expect(badSupplier.statusCode).toBe(400);
    expect((badSupplier.body as { code: string }).code).toBe(
      "SOURCE_BATCH_SUPPLIER_MISMATCH",
    );

    const missing = await postSettlement(id, {
      type: "WEIGHT",
      coveredWeightKg: "5",
      sourceBatchId: "99999999-9999-4999-8999-999999999999",
    });
    expect(missing.statusCode).toBe(400);
    expect((missing.body as { code: string }).code).toBe(
      "SOURCE_BATCH_NOT_FOUND",
    );

    // A source-batch link is never required.
    const noSource = await postSettlement(id, {
      type: "WEIGHT",
      coveredWeightKg: "1",
    });
    expect(noSource.statusCode).toBe(201);
  });

  it("prevents concurrent settlements from exceeding the remaining magnitude", async () => {
    const id = await seedDiscrepancy(supplierId, "980.000", "1000.000");
    const [first, second] = await Promise.all([
      postSettlement(id, { type: "WEIGHT", coveredWeightKg: "15" }),
      postSettlement(id, { type: "WEIGHT", coveredWeightKg: "15" }),
    ]);
    const codes = [first.statusCode, second.statusCode].sort();
    expect(codes).toEqual([201, 409]);
    const detail = await getDetail(id);
    expect(detail.settledWeight).toBe("15");
    expect(detail.remainingWeight).toBe("5");
  });

  it("restricts settlement writes to ADMIN", async () => {
    const id = await seedDiscrepancy(supplierId, "980.000", "1000.000");
    expect(
      (
        await postSettlement(
          id,
          { type: "WEIGHT", coveredWeightKg: "5" },
          workerCookie,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (await postSettlement(id, { type: "WEIGHT", coveredWeightKg: "5" }, null))
        .statusCode,
    ).toBe(401);
  });
});
