import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RoleKey } from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { LoginAttemptService } from "../src/modules/auth/login-attempt.service";
import { hashPassword } from "../src/modules/auth/password";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_pwreset_";
const UNKNOWN_UUID = "55555555-5555-4555-8555-555555555555";

describe.skipIf(!dbAvailable)("Administrator password reset (integration)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let attempts: LoginAttemptService;
  let adminCookie: string;
  let workerCookie: string;

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

  async function userId(suffix: string): Promise<string> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { username: `${PREFIX}${suffix}` },
    });
    return user.id;
  }

  it("lets an administrator reset another user's password without exposing secrets", async () => {
    await seedUser("target", "old-password-123", ["ACCOUNTING"]);
    const targetCookie = await login(`${PREFIX}target`, "old-password-123");
    const id = await userId("target");

    const res = await app.inject({
      method: "PATCH",
      url: `/users/${id}/password`,
      ...auth(adminCookie),
      payload: { password: "new-password-456" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.username).toBe(`${PREFIX}target`);
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(JSON.stringify(body)).not.toContain("$argon2");

    // The old password immediately stops working...
    const oldLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: `${PREFIX}target`, password: "old-password-123" },
    });
    expect(oldLogin.statusCode).toBe(401);

    // ...the new password works...
    const newLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: `${PREFIX}target`, password: "new-password-456" },
    });
    expect(newLogin.statusCode).toBe(200);

    // ...and the target's pre-reset session is invalidated.
    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      ...auth(targetCookie),
    });
    expect(me.statusCode).toBe(401);
  });

  it("does not invalidate other users' or the administrator's sessions", async () => {
    await seedUser("iso", "iso-password-123", ["ACCOUNTING"]);
    const id = await userId("iso");

    const res = await app.inject({
      method: "PATCH",
      url: `/users/${id}/password`,
      ...auth(adminCookie),
      payload: { password: "iso-new-password-123" },
    });
    expect(res.statusCode).toBe(200);

    expect(
      (await app.inject({ method: "GET", url: "/auth/me", ...auth(workerCookie) }))
        .statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: "GET", url: "/auth/me", ...auth(adminCookie) }))
        .statusCode,
    ).toBe(200);
  });

  it("rejects unauthenticated and non-admin resets", async () => {
    await seedUser("guard", "guard-password-123", ["ACCOUNTING"]);
    const id = await userId("guard");

    const unauth = await app.inject({
      method: "PATCH",
      url: `/users/${id}/password`,
      payload: { password: "whatever-12345" },
    });
    expect(unauth.statusCode).toBe(401);

    const forbidden = await app.inject({
      method: "PATCH",
      url: `/users/${id}/password`,
      ...auth(workerCookie),
      payload: { password: "whatever-12345" },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it("returns 404 with an explicit code for an unknown user", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${UNKNOWN_UUID}/password`,
      ...auth(adminCookie),
      payload: { password: "whatever-12345" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("USER_NOT_FOUND");
  });

  it("rejects a too-short password with a structured validation code", async () => {
    await seedUser("short", "short-password-123", ["ACCOUNTING"]);
    const id = await userId("short");

    const res = await app.inject({
      method: "PATCH",
      url: `/users/${id}/password`,
      ...auth(adminCookie),
      payload: { password: "abcde" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    // Structured field detail lets the client show an actionable message.
    expect(res.json().errors?.[0]?.path).toBe("password");
  });

  it("accepts the shared 6-character minimum", async () => {
    await seedUser("six", "six-password-123", ["ACCOUNTING"]);
    const id = await userId("six");

    const res = await app.inject({
      method: "PATCH",
      url: `/users/${id}/password`,
      ...auth(adminCookie),
      payload: { password: "abcdef" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("does not accept a password in the generic user update", async () => {
    await seedUser("generic", "generic-password-123", ["ACCOUNTING"]);
    const id = await userId("generic");

    const res = await app.inject({
      method: "PATCH",
      url: `/users/${id}`,
      ...auth(adminCookie),
      payload: { password: "should-not-be-accepted" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("invalidates the administrator's own session when they reset their own password", async () => {
    const id = await userId("admin");

    const res = await app.inject({
      method: "PATCH",
      url: `/users/${id}/password`,
      ...auth(adminCookie),
      payload: { password: "admin-new-password-789" },
    });
    expect(res.statusCode).toBe(200);

    // The administrator's previous token is now invalid...
    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      ...auth(adminCookie),
    });
    expect(me.statusCode).toBe(401);

    // ...and the new password signs in.
    const fresh = await login(`${PREFIX}admin`, "admin-new-password-789");
    expect(fresh.length).toBeGreaterThan(20);
  });
});
