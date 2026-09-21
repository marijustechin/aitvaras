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
const PREFIX = "test_profile_";

describe.skipIf(!dbAvailable)("Profile (integration)", () => {
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

  it("rejects unauthenticated profile updates", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/auth/me",
      payload: { firstName: "X" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("updates the authenticated user's first and last name", async () => {
    await createUser("name", "password-123", ["WAREHOUSE_WORKER"]);
    const cookie = await login(`${PREFIX}name`, "password-123");

    const res = await app.inject({
      method: "PATCH",
      url: "/auth/me",
      ...auth(cookie),
      payload: { firstName: "  Jonas ", lastName: "Jonaitis" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().firstName).toBe("Jonas");
    expect(res.json().lastName).toBe("Jonaitis");

    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      ...auth(cookie),
    });
    expect(me.json().firstName).toBe("Jonas");
    expect(me.json().lastName).toBe("Jonaitis");
  });

  it("rejects attempts to change roles, active state or username", async () => {
    await createUser("immutable", "password-123", ["ACCOUNTING"]);
    const cookie = await login(`${PREFIX}immutable`, "password-123");

    for (const payload of [
      { roles: ["ADMIN"] },
      { active: false },
      { username: "changed" },
    ]) {
      const res = await app.inject({
        method: "PATCH",
        url: "/auth/me",
        ...auth(cookie),
        payload,
      });
      expect(res.statusCode).toBe(400);
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { username: `${PREFIX}immutable` },
      include: { roles: { include: { role: true } } },
    });
    expect(user.active).toBe(true);
    expect(user.roles.map((assignment) => assignment.role.key)).toEqual([
      "ACCOUNTING",
    ]);
  });

  it("changes the password only with the correct current password", async () => {
    await createUser("pw", "old-password-123", ["ACCOUNTING"]);
    const cookie = await login(`${PREFIX}pw`, "old-password-123");

    const wrong = await app.inject({
      method: "PATCH",
      url: "/auth/me",
      ...auth(cookie),
      payload: { currentPassword: "not-it", newPassword: "new-password-456" },
    });
    expect(wrong.statusCode).toBe(400);

    const ok = await app.inject({
      method: "PATCH",
      url: "/auth/me",
      ...auth(cookie),
      payload: { currentPassword: "old-password-123", newPassword: "new-password-456" },
    });
    expect(ok.statusCode).toBe(200);

    const oldLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: `${PREFIX}pw`, password: "old-password-123" },
    });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: `${PREFIX}pw`, password: "new-password-456" },
    });
    expect(newLogin.statusCode).toBe(200);
  });

  it("self-profile only affects the authenticated user", async () => {
    await createUser("self", "password-123", ["ACCOUNTING"]);
    await createUser("other", "password-123", ["ACCOUNTING"]);
    const cookie = await login(`${PREFIX}self`, "password-123");

    const res = await app.inject({
      method: "PATCH",
      url: "/auth/me",
      ...auth(cookie),
      payload: { firstName: "Changed" },
    });
    expect(res.statusCode).toBe(200);

    const other = await prisma.user.findUniqueOrThrow({
      where: { username: `${PREFIX}other` },
    });
    expect(other.firstName).toBe("Test");
    expect(other.lastName).toBe("other");
  });
});
