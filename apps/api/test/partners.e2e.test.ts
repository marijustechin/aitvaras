import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Partner, PartnerRoleKey, RoleKey } from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { LoginAttemptService } from "../src/modules/auth/login-attempt.service";
import { hashPassword } from "../src/modules/auth/password";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_partners_";
const UNKNOWN_UUID = "11111111-1111-4111-8111-111111111111";

describe.skipIf(!dbAvailable)("Partners (integration)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let attempts: LoginAttemptService;
  let adminCookie: string;
  let workerCookie: string;
  let nextCompanyCode = 0;

  function uniqueCompanyCode(): string {
    nextCompanyCode += 1;
    return `00${String(nextCompanyCode).padStart(5, "0")}`;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    attempts = app.get(LoginAttemptService);

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

  beforeEach(() => {
    attempts.clearAll();
  });

  async function cleanup(): Promise<void> {
    await prisma.businessPartner.deleteMany({
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

  async function createPartner(
    name: string,
    roles: PartnerRoleKey[],
    extra: Record<string, unknown> = {},
  ): Promise<Partner> {
    const res = await app.inject({
      method: "POST",
      url: "/partners",
      ...auth(adminCookie),
      payload: {
        name,
        roles,
        country: "LT",
        companyCode: uniqueCompanyCode(),
        ...extra,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as Partner;
  }

  it("rejects unauthenticated access", async () => {
    const res = await app.inject({ method: "GET", url: "/partners" });
    expect(res.statusCode).toBe(401);
  });

  it("allows an authenticated non-admin to list and read partners", async () => {
    const partner = await createPartner(`${PREFIX}readable`, ["SUPPLIER"]);

    const list = await app.inject({
      method: "GET",
      url: "/partners",
      ...auth(workerCookie),
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as Partner[]).map((item) => item.name)).toContain(
      `${PREFIX}readable`,
    );

    const detail = await app.inject({
      method: "GET",
      url: `/partners/${partner.id}`,
      ...auth(workerCookie),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().id).toBe(partner.id);
  });

  it("forbids a non-admin from creating or updating", async () => {
    const partner = await createPartner(`${PREFIX}guarded`, ["BUYER"]);

    const create = await app.inject({
      method: "POST",
      url: "/partners",
      ...auth(workerCookie),
      payload: { name: `${PREFIX}nope`, roles: ["SUPPLIER"] },
    });
    expect(create.statusCode).toBe(403);

    const update = await app.inject({
      method: "PATCH",
      url: `/partners/${partner.id}`,
      ...auth(workerCookie),
      payload: { name: `${PREFIX}renamed-by-worker` },
    });
    expect(update.statusCode).toBe(403);
  });

  it("creates supplier-only, buyer-only and combined partners", async () => {
    const supplier = await createPartner(`${PREFIX}supplier`, ["SUPPLIER"]);
    expect(supplier.roles).toEqual(["SUPPLIER"]);

    const buyer = await createPartner(`${PREFIX}buyer`, ["BUYER"]);
    expect(buyer.roles).toEqual(["BUYER"]);

    const both = await createPartner(`${PREFIX}both`, ["SUPPLIER", "BUYER"]);
    expect(both.roles).toEqual(["SUPPLIER", "BUYER"]);
  });

  it("defaults to active, trims text and normalises empty optionals to null", async () => {
    const partner = await createPartner(`${PREFIX}  trimmed  `, ["SUPPLIER"], {
      notes: "  pastaba  ",
    });

    expect(partner.name).toBe(`${PREFIX}  trimmed  `.trim());
    expect(partner.active).toBe(true);
    expect(partner.country).toBe("LT");
    expect(partner.notes).toBe("pastaba");
    expect(partner.companyCode).toMatch(/^00\d{5}$/);
  });

  it("rejects zero roles, blank name, unknown fields and malformed ids", async () => {
    for (const payload of [
      { name: `${PREFIX}zero`, roles: [], country: "LT", companyCode: uniqueCompanyCode() },
      { name: "   ", roles: ["SUPPLIER"], country: "LT", companyCode: uniqueCompanyCode() },
      { roles: ["SUPPLIER"], country: "LT", companyCode: uniqueCompanyCode() },
      {
        name: `${PREFIX}bogus`,
        roles: ["SUPPLIER"],
        country: "LT",
        companyCode: uniqueCompanyCode(),
        id: UNKNOWN_UUID,
      },
      {
        name: `${PREFIX}bogus`,
        roles: ["SUPPLIER"],
        country: "LT",
        companyCode: uniqueCompanyCode(),
        createdAt: "2026-01-01",
      },
    ]) {
      const res = await app.inject({
        method: "POST",
        url: "/partners",
        ...auth(adminCookie),
        payload,
      });
      expect(res.statusCode).toBe(400);
    }

    const badId = await app.inject({
      method: "GET",
      url: "/partners/not-a-uuid",
      ...auth(adminCookie),
    });
    expect(badId.statusCode).toBe(400);

    const missing = await app.inject({
      method: "GET",
      url: `/partners/${UNKNOWN_UUID}`,
      ...auth(adminCookie),
    });
    expect(missing.statusCode).toBe(404);
  });

  it("requires name, country and registration number for company partners", async () => {
    for (const payload of [
      { roles: ["SUPPLIER"], country: "LT", companyCode: uniqueCompanyCode() },
      { name: `${PREFIX}no-country`, roles: ["SUPPLIER"], companyCode: uniqueCompanyCode() },
      { name: `${PREFIX}no-code`, roles: ["SUPPLIER"], country: "LT" },
      {
        name: `${PREFIX}blank-code`,
        roles: ["SUPPLIER"],
        country: "LT",
        companyCode: "   ",
      },
      {
        name: `${PREFIX}bad-country`,
        roles: ["SUPPLIER"],
        country: "Lietuva",
        companyCode: uniqueCompanyCode(),
      },
    ]) {
      const res = await app.inject({
        method: "POST",
        url: "/partners",
        ...auth(adminCookie),
        payload,
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it("preserves leading zeros and trims the registration number", async () => {
    const partner = await createPartner(`${PREFIX}zeros`, ["SUPPLIER"], {
      country: "LT",
      companyCode: "  0000123  ",
    });
    expect(partner.companyCode).toBe("0000123");

    const detail = await app.inject({
      method: "GET",
      url: `/partners/${partner.id}`,
      ...auth(adminCookie),
    });
    expect(detail.json().companyCode).toBe("0000123");
  });

  it("rejects duplicate country + registration number with field errors", async () => {
    const code = uniqueCompanyCode();
    await createPartner(`${PREFIX}duplicate-first`, ["SUPPLIER"], {
      country: "LT",
      companyCode: code,
    });

    const duplicate = await app.inject({
      method: "POST",
      url: "/partners",
      ...auth(adminCookie),
      payload: {
        name: `${PREFIX}duplicate-second`,
        roles: ["SUPPLIER"],
        country: "LT",
        companyCode: code,
      },
    });
    expect(duplicate.statusCode).toBe(409);
    const body = duplicate.json() as {
      code: string;
      errors: { path: string; message: string }[];
    };
    expect(body.code).toBe("PARTNER_DUPLICATE_IDENTIFICATION");
    expect(body.errors).toContainEqual(
      expect.objectContaining({
        path: "companyCode",
        message: expect.stringContaining("jau yra partneris"),
      }),
    );
  });

  it("allows the same registration number in a different country", async () => {
    const code = uniqueCompanyCode();
    const lithuanian = await createPartner(`${PREFIX}same-code-lt`, ["SUPPLIER"], {
      country: "LT",
      companyCode: code,
    });
    const latvian = await createPartner(`${PREFIX}same-code-lv`, ["SUPPLIER"], {
      country: "LV",
      companyCode: code,
    });
    expect(lithuanian.companyCode).toBe(code);
    expect(latvian.companyCode).toBe(code);
    expect(lithuanian.country).toBe("LT");
    expect(latvian.country).toBe("LV");
  });

  it("enforces the unique combination in the database as a final guard", async () => {
    const code = uniqueCompanyCode();
    await createPartner(`${PREFIX}db-constraint-first`, ["SUPPLIER"], {
      country: "LT",
      companyCode: code,
    });

    await expect(
      prisma.businessPartner.create({
        data: {
          name: `${PREFIX}db-constraint-second`,
          country: "LT",
          companyCode: code,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("edits an existing partner without changing its identification", async () => {
    const partner = await createPartner(`${PREFIX}unchanged-id`, ["SUPPLIER"], {
      country: "GB",
      companyCode: "000777",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/partners/${partner.id}`,
      ...auth(adminCookie),
      payload: {
        name: `${PREFIX}unchanged-id-renamed`,
        roles: ["SUPPLIER", "BUYER"],
        country: "GB",
        companyCode: "000777",
        active: true,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe(`${PREFIX}unchanged-id-renamed`);
    expect(res.json().country).toBe("GB");
    expect(res.json().companyCode).toBe("000777");
  });

  it("never allows clearing required identification on update", async () => {
    const partner = await createPartner(`${PREFIX}clear-id`, ["SUPPLIER"]);

    for (const payload of [
      { companyCode: "" },
      { country: "" },
      { name: "   " },
      { country: "Narnija" },
    ]) {
      const res = await app.inject({
        method: "PATCH",
        url: `/partners/${partner.id}`,
        ...auth(adminCookie),
        payload,
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it("lets an admin change name and roles, keeping at least one role", async () => {
    const partner = await createPartner(`${PREFIX}edit`, ["SUPPLIER"]);

    const updated = await app.inject({
      method: "PATCH",
      url: `/partners/${partner.id}`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}edit-renamed`, roles: ["SUPPLIER", "BUYER"] },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().name).toBe(`${PREFIX}edit-renamed`);
    expect(updated.json().roles).toEqual(["SUPPLIER", "BUYER"]);

    const zero = await app.inject({
      method: "PATCH",
      url: `/partners/${partner.id}`,
      ...auth(adminCookie),
      payload: { roles: [] },
    });
    expect(zero.statusCode).toBe(400);

    const empty = await app.inject({
      method: "PATCH",
      url: `/partners/${partner.id}`,
      ...auth(adminCookie),
      payload: {},
    });
    expect(empty.statusCode).toBe(400);
  });

  it("deactivates a partner without removing it", async () => {
    const partner = await createPartner(`${PREFIX}inactive`, ["SUPPLIER"]);

    const deactivated = await app.inject({
      method: "PATCH",
      url: `/partners/${partner.id}`,
      ...auth(adminCookie),
      payload: { active: false },
    });
    expect(deactivated.statusCode).toBe(200);
    expect(deactivated.json().active).toBe(false);

    const detail = await app.inject({
      method: "GET",
      url: `/partners/${partner.id}`,
      ...auth(workerCookie),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().active).toBe(false);

    const list = await app.inject({
      method: "GET",
      url: "/partners",
      ...auth(workerCookie),
    });
    const found = (list.json() as Partner[]).find(
      (item) => item.id === partner.id,
    );
    expect(found?.active).toBe(false);
  });

  it("never mutates another partner on update", async () => {
    const first = await createPartner(`${PREFIX}first`, ["SUPPLIER"]);
    const second = await createPartner(`${PREFIX}second`, ["BUYER"]);

    const res = await app.inject({
      method: "PATCH",
      url: `/partners/${first.id}`,
      ...auth(adminCookie),
      payload: { name: `${PREFIX}first-changed` },
    });
    expect(res.statusCode).toBe(200);

    const untouched = await prisma.businessPartner.findUniqueOrThrow({
      where: { id: second.id },
      include: { roles: true },
    });
    expect(untouched.name).toBe(`${PREFIX}second`);
    expect(untouched.roles.map((role) => role.role)).toEqual(["BUYER"]);
  });

  it("returns a deterministic role representation regardless of input order", async () => {
    const partner = await createPartner(`${PREFIX}ordered`, [
      "BUYER",
      "SUPPLIER",
      "BUYER",
    ] as PartnerRoleKey[]);
    expect(partner.roles).toEqual(["SUPPLIER", "BUYER"]);

    const stored = await prisma.partnerRole.findMany({
      where: { partnerId: partner.id },
    });
    expect(stored).toHaveLength(2);
  });

  it("lists partners ordered by name ascending", async () => {
    await createPartner(`${PREFIX}ord-b`, ["BUYER"]);
    await createPartner(`${PREFIX}ord-a`, ["BUYER"]);

    const res = await app.inject({
      method: "GET",
      url: "/partners",
      ...auth(workerCookie),
    });
    const names = (res.json() as Partner[])
      .map((item) => item.name)
      .filter((name) => name.startsWith(`${PREFIX}ord-`));
    expect(names).toEqual([`${PREFIX}ord-a`, `${PREFIX}ord-b`]);
  });
});
