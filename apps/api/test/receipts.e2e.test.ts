import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { GoodsReceipt, RoleKey } from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { hashPassword } from "../src/modules/auth/password";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_receipts_";
const MISSING_UUID = "99999999-9999-4999-8999-999999999999";

describe.skipIf(!dbAvailable)("Goods receipts (integration)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let cookie: string;

  let supplierId: string;
  let supplierBuyerId: string;
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
    cookie = await login(`${PREFIX}worker`, "worker-password-123");

    supplierId = await seedPartner("supplier", ["SUPPLIER"]);
    supplierBuyerId = await seedPartner("supplier-buyer", ["SUPPLIER", "BUYER"]);
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

  async function seedResource(suffix: string, active: boolean): Promise<string> {
    const resource = await prisma.resource.create({
      data: { name: `${PREFIX}${suffix}`, category: "RAW_MATERIAL", active },
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

  function auth() {
    return { cookies: { [AUTH_COOKIE_NAME]: cookie } };
  }

  function line(
    overrides: Partial<{
      resourceId: string;
      quantity: string;
      unit: string;
      unitPrice: string;
      warehouseId: string;
      warehouseLocationId: string;
    }> = {},
  ) {
    return {
      resourceId: activeResourceId,
      quantity: "1250",
      unit: "KG",
      unitPrice: "1.42",
      warehouseId: warehouseAId,
      warehouseLocationId: locationA1Id,
      ...overrides,
    };
  }

  async function createReceipt(payload: Record<string, unknown>): Promise<{
    statusCode: number;
    body: unknown;
  }> {
    const res = await app.inject({
      method: "POST",
      url: "/receipts",
      ...auth(),
      payload,
    });
    return { statusCode: res.statusCode, body: res.json() };
  }

  it("rejects unauthenticated requests", async () => {
    expect((await app.inject({ method: "GET", url: "/receipts" })).statusCode).toBe(
      401,
    );
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/receipts",
          payload: { partnerId: supplierId, lines: [line()] },
        })
      ).statusCode,
    ).toBe(401);
  });

  it("lists receipts for an authenticated user", async () => {
    const res = await app.inject({ method: "GET", url: "/receipts", ...auth() });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("creates a receipt with placement and derives totals", async () => {
    const { statusCode, body } = await createReceipt({
      partnerId: supplierId,
      lines: [line({ quantity: "12.5", unitPrice: "3.5" })],
    });
    expect(statusCode).toBe(201);
    const receipt = body as GoodsReceipt;
    expect(receipt.partnerName).toBe(`${PREFIX}supplier`);
    expect(receipt.lines).toHaveLength(1);
    const first = receipt.lines[0]!;
    expect(first.quantity).toBe("12.5");
    expect(first.lineTotal).toBe("43.75");
    expect(first.warehouseId).toBe(warehouseAId);
    expect(first.warehouseName).toBe(`${PREFIX}warehouse-a`);
    expect(first.warehouseLocationId).toBe(locationA1Id);
    expect(first.warehouseLocationName).toBe(`${PREFIX}a1`);
    expect(receipt.total).toBe("43.75");
  });

  it("allows multiple lines in different warehouses and persists atomically", async () => {
    const { statusCode, body } = await createReceipt({
      partnerId: supplierBuyerId,
      lines: [
        line({ quantity: "2", unit: "UNIT", unitPrice: "10" }),
        line({
          quantity: "3",
          unit: "UNIT",
          unitPrice: "2.5",
          warehouseId: warehouseBId,
          warehouseLocationId: locationB1Id,
        }),
      ],
    });
    expect(statusCode).toBe(201);
    const receipt = body as GoodsReceipt;
    expect(receipt.lines.map((l) => l.warehouseId)).toEqual([
      warehouseAId,
      warehouseBId,
    ]);
    expect(receipt.total).toBe("27.5");

    const stored = await prisma.goodsReceiptLine.count({
      where: { goodsReceiptId: receipt.id },
    });
    expect(stored).toBe(2);
  });

  it("accepts a line with no location and mixes located/unlocated lines", async () => {
    const { statusCode, body } = await createReceipt({
      partnerId: supplierId,
      lines: [
        line({ warehouseLocationId: undefined }),
        line({ warehouseId: warehouseBId, warehouseLocationId: locationB1Id }),
      ],
    });
    expect(statusCode).toBe(201);
    const receipt = body as GoodsReceipt;
    expect(receipt.lines[0]?.warehouseLocationId).toBeNull();
    expect(receipt.lines[0]?.warehouseLocationName).toBeNull();
    expect(receipt.lines[0]?.warehouseName).toBe(`${PREFIX}warehouse-a`);
    expect(receipt.lines[1]?.warehouseLocationName).toBe(`${PREFIX}b1`);
  });

  it("rejects an ineligible partner (buyer-only, inactive or missing)", async () => {
    for (const partnerId of [buyerOnlyId, inactiveSupplierId, MISSING_UUID]) {
      const { statusCode } = await createReceipt({
        partnerId,
        lines: [line()],
      });
      expect(statusCode, partnerId).toBe(400);
    }
  });

  it("rejects inactive or missing resources", async () => {
    expect(
      (await createReceipt({ partnerId: supplierId, lines: [line({ resourceId: inactiveResourceId })] }))
        .statusCode,
    ).toBe(400);
    expect(
      (await createReceipt({ partnerId: supplierId, lines: [line({ resourceId: MISSING_UUID })] }))
        .statusCode,
    ).toBe(400);
  });

  it("rejects invalid warehouse/location placement", async () => {
    const inactiveWarehouse = await createReceipt({
      partnerId: supplierId,
      lines: [line({ warehouseId: inactiveWarehouseId, warehouseLocationId: locationA1Id })],
    });
    expect(inactiveWarehouse.statusCode).toBe(400);

    const inactiveLocation = await createReceipt({
      partnerId: supplierId,
      lines: [line({ warehouseLocationId: inactiveLocationId })],
    });
    expect(inactiveLocation.statusCode).toBe(400);

    const mismatched = await createReceipt({
      partnerId: supplierId,
      lines: [line({ warehouseId: warehouseAId, warehouseLocationId: locationB1Id })],
    });
    expect(mismatched.statusCode).toBe(400);
    expect((mismatched.body as { message: string }).message).toContain(
      "nepriklauso",
    );

    expect(
      (
        await createReceipt({
          partnerId: supplierId,
          lines: [line({ warehouseId: MISSING_UUID, warehouseLocationId: locationA1Id })],
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await createReceipt({
          partnerId: supplierId,
          lines: [line({ warehouseLocationId: MISSING_UUID })],
        })
      ).statusCode,
    ).toBe(400);
  });

  it("rejects invalid payloads (zero lines, quantity, unit, price, placement, unknown fields)", async () => {
    const cases: Record<string, unknown>[] = [
      { partnerId: supplierId, lines: [] },
      { partnerId: supplierId, lines: [line({ quantity: "0" })] },
      { partnerId: supplierId, lines: [line({ quantity: "-5" })] },
      { partnerId: supplierId, lines: [line({ unit: "L" })] },
      { partnerId: supplierId, lines: [line({ unitPrice: "-1" })] },
      { partnerId: supplierId, lines: [{ ...line(), warehouseId: undefined }] },
      { partnerId: supplierId, lines: [line()], status: "DRAFT" },
    ];
    for (const payload of cases) {
      const { statusCode } = await createReceipt(payload);
      expect(statusCode, JSON.stringify(payload)).toBe(400);
    }
  });

  it("leaves no partial receipt when a line fails", async () => {
    const before = await prisma.goodsReceipt.count({
      where: { partner: { name: { startsWith: PREFIX } } },
    });
    const { statusCode } = await createReceipt({
      partnerId: supplierId,
      lines: [line(), line({ warehouseLocationId: locationB1Id })],
    });
    expect(statusCode).toBe(400);
    const after = await prisma.goodsReceipt.count({
      where: { partner: { name: { startsWith: PREFIX } } },
    });
    expect(after).toBe(before);
  });

  it("keeps a historical receipt readable after placement deactivation", async () => {
    const { statusCode, body } = await createReceipt({
      partnerId: supplierId,
      lines: [line()],
    });
    expect(statusCode).toBe(201);
    const receipt = body as GoodsReceipt;

    await prisma.warehouse.update({
      where: { id: warehouseAId },
      data: { active: false },
    });
    await prisma.warehouseLocation.update({
      where: { id: locationA1Id },
      data: { active: false },
    });

    const detail = await app.inject({
      method: "GET",
      url: `/receipts/${receipt.id}`,
      ...auth(),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().lines[0].warehouseName).toBe(`${PREFIX}warehouse-a`);
    expect(detail.json().lines[0].warehouseLocationName).toBe(`${PREFIX}a1`);

    await prisma.warehouse.update({
      where: { id: warehouseAId },
      data: { active: true },
    });
    await prisma.warehouseLocation.update({
      where: { id: locationA1Id },
      data: { active: true },
    });
  });

  it("returns receipts newest first and 400/404 for bad ids", async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    await createReceipt({ partnerId: supplierId, lines: [line()] });

    const list = await app.inject({ method: "GET", url: "/receipts", ...auth() });
    const ours = (list.json() as GoodsReceipt[]).filter((receipt) =>
      receipt.partnerName.startsWith(PREFIX),
    );
    const times = ours.map((receipt) => Date.parse(receipt.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));

    expect(
      (
        await app.inject({
          method: "GET",
          url: `/receipts/${MISSING_UUID}`,
          ...auth(),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/receipts/not-a-uuid",
          ...auth(),
        })
      ).statusCode,
    ).toBe(400);
  });
});
