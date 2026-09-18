import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type { RoleKey } from "@aitvaras/contracts";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { hashPassword } from "../src/modules/auth/password";
import { isDatabaseReachable } from "./support/test-env";

const dbAvailable = await isDatabaseReachable();
const PREFIX = "test_auth_";

describe.skipIf(!dbAvailable)("Auth (integration)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({
      where: { username: { startsWith: PREFIX } },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { username: { startsWith: PREFIX } },
      });
    }
    if (app) {
      await app.close();
    }
  });

  async function createUser(
    suffix: string,
    password: string,
    roles: RoleKey[],
    active = true,
  ): Promise<void> {
    const roleRecords = await prisma.role.findMany({
      where: { key: { in: roles } },
    });
    await prisma.user.create({
      data: {
        username: `${PREFIX}${suffix}`,
        firstName: "Test",
        lastName: suffix,
        passwordHash: await hashPassword(password),
        active,
        roles: { create: roleRecords.map((role) => ({ roleId: role.id })) },
      },
    });
  }

  it("logs in with valid credentials and never returns secrets", async () => {
    await createUser("login", "valid-password-123", ["ADMIN"]);

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: `${PREFIX}login`, password: "valid-password-123" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.accessToken).toBe("string");
    expect(body.accessToken.length).toBeGreaterThan(20);
    expect(body.tokenType).toBe("Bearer");
    expect(body.user.username).toBe(`${PREFIX}login`);
    expect(body.user.firstName).toBe("Test");
    expect(body.user.lastName).toBe("login");
    expect(body.user.roles).toContain("ADMIN");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(JSON.stringify(body)).not.toContain("$argon2");
  });

  it("rejects a wrong password generically", async () => {
    await createUser("wrong", "valid-password-123", ["ADMIN"]);

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: `${PREFIX}wrong`, password: "not-the-password" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe("Invalid credentials");
  });

  it("rejects an unknown user generically", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: `${PREFIX}ghost`, password: "whatever-123" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe("Invalid credentials");
  });

  it("rejects an inactive user", async () => {
    await createUser("inactive", "valid-password-123", ["ADMIN"], false);

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: `${PREFIX}inactive`, password: "valid-password-123" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns the authenticated user for /auth/me", async () => {
    await createUser("me", "valid-password-123", ["ADMIN", "ACCOUNTING"]);

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: `${PREFIX}me`, password: "valid-password-123" },
    });
    const token = login.json().accessToken as string;

    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().username).toBe(`${PREFIX}me`);
    expect(res.json().firstName).toBe("Test");
    expect(res.json().lastName).toBe("me");
    expect([...res.json().roles].sort()).toEqual(["ACCOUNTING", "ADMIN"]);
  });

  it("rejects /auth/me without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects /auth/me with an invalid token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: "Bearer not-a-real-jwt" },
    });
    expect(res.statusCode).toBe(401);
  });
});
