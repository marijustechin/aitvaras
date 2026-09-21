import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { JwtService } from "@nestjs/jwt";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RoleKey } from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { LoginAttemptService } from "../src/modules/auth/login-attempt.service";
import { hashPassword } from "../src/modules/auth/password";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_auth_";

describe.skipIf(!dbAvailable)("Auth (integration)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let attempts: LoginAttemptService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    attempts = app.get(LoginAttemptService);
    await cleanup();
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
    await prisma.user.deleteMany({
      where: { username: { startsWith: PREFIX } },
    });
  }

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

  async function login(username: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username, password },
    });
    const cookie = res.cookies.find((c) => c.name === AUTH_COOKIE_NAME)?.value;
    return { res, cookie };
  }

  function setCookie(res: Awaited<ReturnType<typeof login>>["res"]): string {
    return ([] as string[])
      .concat(res.headers["set-cookie"] ?? [])
      .join("; ");
  }

  it("logs in, sets an httpOnly cookie, and never returns the raw token", async () => {
    await createUser("login", "valid-password-123", ["ADMIN"]);

    const { res, cookie } = await login(
      `${PREFIX}login`,
      "valid-password-123",
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.username).toBe(`${PREFIX}login`);
    expect(body.user.firstName).toBe("Test");
    expect(body.user.roles).toContain("ADMIN");
    expect(body.accessToken).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("$argon2");

    expect(typeof cookie).toBe("string");
    const header = setCookie(res);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toMatch(/Path=\//i);
    expect(header).toMatch(/Max-Age=3600/i);
  });

  it("authenticates /auth/me from the cookie", async () => {
    await createUser("me", "valid-password-123", ["ADMIN", "ACCOUNTING"]);
    const { cookie } = await login(`${PREFIX}me`, "valid-password-123");

    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { [AUTH_COOKIE_NAME]: cookie as string },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().username).toBe(`${PREFIX}me`);
    expect(res.json().firstName).toBe("Test");
    expect([...res.json().roles].sort()).toEqual(["ACCOUNTING", "ADMIN"]);
  });

  it("rejects /auth/me without a cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects /auth/me with an invalid cookie", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { [AUTH_COOKIE_NAME]: "not-a-real-jwt" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects /auth/me with an expired token", async () => {
    const jwt = app.get(JwtService);
    const expired = await jwt.signAsync(
      {
        sub: "00000000-0000-0000-0000-000000000000",
        username: "x",
        roles: [],
      },
      { expiresIn: "-10s" },
    );
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { [AUTH_COOKIE_NAME]: expired },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a wrong password generically", async () => {
    await createUser("wrong", "valid-password-123", ["ADMIN"]);
    const { res } = await login(`${PREFIX}wrong`, "not-the-password");
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe("Invalid credentials");
  });

  it("rejects an unknown user generically", async () => {
    const { res } = await login(`${PREFIX}ghost`, "whatever-123");
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe("Invalid credentials");
  });

  it("rejects an inactive user", async () => {
    await createUser("inactive", "valid-password-123", ["ADMIN"], false);
    const { res } = await login(`${PREFIX}inactive`, "valid-password-123");
    expect(res.statusCode).toBe(401);
  });

  it("logout clears the auth cookie", async () => {
    const res = await app.inject({ method: "POST", url: "/auth/logout" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    const header = ([] as string[])
      .concat(res.headers["set-cookie"] ?? [])
      .join("; ");
    expect(header).toMatch(new RegExp(`${AUTH_COOKIE_NAME}=;`));
    expect(header).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("does not authenticate after logout (cleared cookie)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { [AUTH_COOKIE_NAME]: "" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("temporarily locks after repeated failures, then recovers", async () => {
    const username = `${PREFIX}lock`;
    await createUser("lock", "valid-password-123", ["ADMIN"]);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { res } = await login(username, "wrong-password");
      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe("Invalid credentials");
    }

    // Locked: even the correct password is rejected, generically.
    const locked = await login(username, "valid-password-123");
    expect(locked.res.statusCode).toBe(401);
    expect(locked.res.json().message).toBe("Invalid credentials");

    // After clearing the counters, login succeeds again.
    attempts.clearAll();
    const recovered = await login(username, "valid-password-123");
    expect(recovered.res.statusCode).toBe(200);
  });
});
