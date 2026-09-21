import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RoleKey } from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../src/common/auth/auth-cookie";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { hashPassword } from "../src/modules/auth/password";
import { createTestApp } from "./support/create-test-app";
import { isTestDatabaseReachable } from "./support/test-db";

const dbAvailable = await isTestDatabaseReachable();
const PREFIX = "test_users_";

describe.skipIf(!dbAvailable)("Users administration (integration)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let workerCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

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

  it("rejects unauthenticated access to /users", async () => {
    const res = await app.inject({ method: "GET", url: "/users" });
    expect(res.statusCode).toBe(401);
  });

  it("forbids a non-admin role", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/users",
      ...auth(workerCookie),
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows an admin to list users", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/users",
      ...auth(adminCookie),
    });
    expect(res.statusCode).toBe(200);
    const usernames = (res.json() as { username: string }[]).map(
      (user) => user.username,
    );
    expect(usernames).toContain(`${PREFIX}admin`);
  });

  it("creates a user without exposing the password hash, and the user can log in", async () => {
    const username = `${PREFIX}created`;
    const res = await app.inject({
      method: "POST",
      url: "/users",
      ...auth(adminCookie),
      payload: {
        username,
        firstName: "Created",
        lastName: "Person",
        password: "created-password-123",
        roles: ["ACCOUNTING"],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.username).toBe(username);
    expect(body.firstName).toBe("Created");
    expect(body.lastName).toBe("Person");
    expect(body.roles).toEqual(["ACCOUNTING"]);
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(JSON.stringify(body)).not.toContain("$argon2");

    const cookie = await login(username, "created-password-123");
    expect(cookie.length).toBeGreaterThan(20);
  });

  it("rejects a user without a first or last name with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/users",
      ...auth(adminCookie),
      payload: {
        username: `${PREFIX}noname`,
        password: "no-name-password-123",
        roles: ["ACCOUNTING"],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a duplicate username with 409", async () => {
    const payload = {
      username: `${PREFIX}duplicate`,
      firstName: "Dup",
      lastName: "User",
      password: "duplicate-password-123",
      roles: ["ACCOUNTING"],
    };
    const first = await app.inject({
      method: "POST",
      url: "/users",
      ...auth(adminCookie),
      payload,
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/users",
      ...auth(adminCookie),
      payload,
    });
    expect(second.statusCode).toBe(409);
  });

  it("rejects an unknown role with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/users",
      ...auth(adminCookie),
      payload: {
        username: `${PREFIX}badrole`,
        firstName: "Bad",
        lastName: "Role",
        password: "bad-role-password-123",
        roles: ["NOT_A_ROLE"],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a short password with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/users",
      ...auth(adminCookie),
      payload: {
        username: `${PREFIX}shortpw`,
        firstName: "Short",
        lastName: "Password",
        password: "short",
        roles: ["ACCOUNTING"],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("persists role changes, name changes and active state", async () => {
    const username = `${PREFIX}patch`;
    const created = await app.inject({
      method: "POST",
      url: "/users",
      ...auth(adminCookie),
      payload: {
        username,
        firstName: "Patch",
        lastName: "Original",
        password: "patch-password-123",
        roles: ["ACCOUNTING"],
      },
    });
    const id = created.json().id as string;

    const patched = await app.inject({
      method: "PATCH",
      url: `/users/${id}`,
      ...auth(adminCookie),
      payload: {
        firstName: "Patched",
        lastName: "Renamed",
        roles: ["WAREHOUSE_WORKER", "PRODUCTION_MANAGER"],
        active: false,
      },
    });

    expect(patched.statusCode).toBe(200);
    expect(patched.json().firstName).toBe("Patched");
    expect(patched.json().lastName).toBe("Renamed");
    expect([...patched.json().roles].sort()).toEqual([
      "PRODUCTION_MANAGER",
      "WAREHOUSE_WORKER",
    ]);
    expect(patched.json().active).toBe(false);

    const loginAttempt = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username, password: "patch-password-123" },
    });
    expect(loginAttempt.statusCode).toBe(401);
  });
});
