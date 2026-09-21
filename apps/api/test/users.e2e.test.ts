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

  const UNKNOWN_UUID = "44444444-4444-4444-8444-444444444444";

  async function createViaApi(
    suffix: string,
    roles: RoleKey[],
    firstName = "Seed",
  ): Promise<{ id: string }> {
    const res = await app.inject({
      method: "POST",
      url: "/users",
      ...auth(adminCookie),
      payload: {
        username: `${PREFIX}${suffix}`,
        firstName,
        lastName: suffix,
        password: "password-123",
        roles,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string };
  }

  /** Deactivate every active ADMIN except the seeded test admin (test DB only). */
  async function ensureSoleActiveAdmin(): Promise<void> {
    await prisma.user.updateMany({
      where: {
        active: true,
        username: { not: `${PREFIX}admin` },
        roles: { some: { role: { key: "ADMIN" } } },
      },
      data: { active: false },
    });
  }

  async function adminId(): Promise<string> {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { username: `${PREFIX}admin` },
    });
    return admin.id;
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

  it("allows CORS preflight for PATCH (browser update flow)", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/users/anything",
      headers: {
        origin: "http://localhost:3011",
        "access-control-request-method": "PATCH",
        "access-control-request-headers": "content-type",
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3011",
    );
    expect(String(res.headers["access-control-allow-methods"])).toContain(
      "PATCH",
    );
  });

  it("rejects unauthenticated and non-admin mutations", async () => {
    const created = await createViaApi("guard", ["ACCOUNTING"]);

    const unauth = await app.inject({
      method: "PATCH",
      url: `/users/${created.id}`,
      payload: { firstName: "Nope" },
    });
    expect(unauth.statusCode).toBe(401);

    const forbidden = await app.inject({
      method: "PATCH",
      url: `/users/${created.id}`,
      ...auth(workerCookie),
      payload: { firstName: "Nope" },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it("updates another user's names and roles without touching others", async () => {
    const target = await createViaApi("iso-a", ["ACCOUNTING"]);
    const other = await createViaApi("iso-b", ["ACCOUNTING"]);

    const res = await app.inject({
      method: "PATCH",
      url: `/users/${target.id}`,
      ...auth(adminCookie),
      payload: { firstName: "Updated", lastName: "Person", roles: ["WAREHOUSE_WORKER"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().firstName).toBe("Updated");
    expect(res.json().roles).toEqual(["WAREHOUSE_WORKER"]);

    const untouched = await prisma.user.findUniqueOrThrow({
      where: { id: other.id },
      include: { roles: { include: { role: true } } },
    });
    expect(untouched.firstName).toBe("Seed");
    expect(untouched.roles.map((a) => a.role.key)).toEqual(["ACCOUNTING"]);
  });

  it("normalises ADMIN + another role to ADMIN only on create and update", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/users",
      ...auth(adminCookie),
      payload: {
        username: `${PREFIX}normcreate`,
        firstName: "Norm",
        lastName: "Create",
        password: "password-123",
        roles: ["ADMIN", "ACCOUNTING"],
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().roles).toEqual(["ADMIN"]);

    const target = await createViaApi("normupdate", ["ACCOUNTING"]);
    const patched = await app.inject({
      method: "PATCH",
      url: `/users/${target.id}`,
      ...auth(adminCookie),
      payload: { roles: ["ACCOUNTING", "ADMIN"] },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().roles).toEqual(["ADMIN"]);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
      include: { roles: { include: { role: true } } },
    });
    expect(stored.roles.map((a) => a.role.key)).toEqual(["ADMIN"]);
  });

  it("rejects empty roles on create and update", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/users",
      ...auth(adminCookie),
      payload: {
        username: `${PREFIX}emptyroles`,
        firstName: "No",
        lastName: "Roles",
        password: "password-123",
        roles: [],
      },
    });
    expect(created.statusCode).toBe(400);

    const target = await createViaApi("emptyupdate", ["ACCOUNTING"]);
    const patched = await app.inject({
      method: "PATCH",
      url: `/users/${target.id}`,
      ...auth(adminCookie),
      payload: { roles: [] },
    });
    expect(patched.statusCode).toBe(400);
  });

  it("deactivates an active user and reactivates an inactive one", async () => {
    const target = await createViaApi("lifecycle", ["ACCOUNTING"]);

    const off = await app.inject({
      method: "PATCH",
      url: `/users/${target.id}`,
      ...auth(adminCookie),
      payload: { active: false },
    });
    expect(off.statusCode).toBe(200);
    expect(off.json().active).toBe(false);

    const on = await app.inject({
      method: "PATCH",
      url: `/users/${target.id}`,
      ...auth(adminCookie),
      payload: { active: true },
    });
    expect(on.statusCode).toBe(200);
    expect(on.json().active).toBe(true);
  });

  it("refuses to deactivate the last active administrator", async () => {
    await ensureSoleActiveAdmin();
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${await adminId()}`,
      ...auth(adminCookie),
      payload: { active: false },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toBe(
      "Negalima išjungti paskutinio aktyvaus administratoriaus.",
    );
  });

  it("refuses to remove the ADMIN role from the last active administrator", async () => {
    await ensureSoleActiveAdmin();
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${await adminId()}`,
      ...auth(adminCookie),
      payload: { roles: ["WAREHOUSE_WORKER"] },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toBe(
      "Negalima pašalinti paskutinio aktyvaus administratoriaus vaidmens.",
    );
  });

  it("allows removing ADMIN when another active administrator exists", async () => {
    await ensureSoleActiveAdmin();
    const second = await createViaApi("second-admin", ["ADMIN"]);

    const res = await app.inject({
      method: "PATCH",
      url: `/users/${second.id}`,
      ...auth(adminCookie),
      payload: { roles: ["ACCOUNTING"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().roles).toEqual(["ACCOUNTING"]);
  });

  it("returns 404 for an unknown user id", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${UNKNOWN_UUID}`,
      ...auth(adminCookie),
      payload: { active: false },
    });
    expect(res.statusCode).toBe(404);
  });
});
