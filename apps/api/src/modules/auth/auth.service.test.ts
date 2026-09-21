import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";
import { hashPassword } from "./password";

const PASSWORD = "correct horse battery staple";

interface FakeUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  active: boolean;
  roles: { role: { key: string } }[];
}

function createService(user: FakeUser | null, locked = false) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue("signed-token") };
  const config = { get: vi.fn().mockReturnValue("3600") };
  const attempts = {
    isLocked: vi.fn().mockReturnValue(locked),
    recordFailure: vi.fn(),
    reset: vi.fn(),
  };

  return {
    service: new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      attempts as never,
    ),
    prisma,
    attempts,
  };
}

describe("AuthService", () => {
  let activeUser: FakeUser;

  beforeEach(async () => {
    activeUser = {
      id: "11111111-1111-1111-1111-111111111111",
      username: "alice",
      firstName: "Alice",
      lastName: "Anderson",
      passwordHash: await hashPassword(PASSWORD),
      active: true,
      roles: [{ role: { key: "ADMIN" } }],
    };
  });

  it("authenticates valid credentials, issues a token and resets attempts", async () => {
    const { service, attempts } = createService(activeUser);

    const result = await service.login("alice", PASSWORD, "127.0.0.1");

    expect(result.accessToken).toBe("signed-token");
    expect(result.expiresIn).toBe(3600);
    expect(result.user).toEqual({
      id: activeUser.id,
      username: "alice",
      firstName: "Alice",
      lastName: "Anderson",
      roles: ["ADMIN"],
    });
    expect(attempts.reset).toHaveBeenCalled();
    expect(attempts.recordFailure).not.toHaveBeenCalled();
  });

  it("records a failure and rejects a wrong password generically", async () => {
    const { service, attempts } = createService(activeUser);
    await expect(service.login("alice", "wrong", "127.0.0.1")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(attempts.recordFailure).toHaveBeenCalled();
    expect(attempts.reset).not.toHaveBeenCalled();
  });

  it("records a failure for an unknown user", async () => {
    const { service, attempts } = createService(null);
    await expect(service.login("nobody", PASSWORD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(attempts.recordFailure).toHaveBeenCalled();
  });

  it("rejects an inactive user", async () => {
    const { service } = createService({ ...activeUser, active: false });
    await expect(service.login("alice", PASSWORD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects a locked attempt without checking credentials", async () => {
    const { service, prisma, attempts } = createService(activeUser, true);
    await expect(service.login("alice", PASSWORD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(attempts.recordFailure).not.toHaveBeenCalled();
  });

  it("returns the authenticated user for /auth/me", async () => {
    const { service } = createService(activeUser);
    await expect(service.getAuthenticatedUser(activeUser.id)).resolves.toEqual({
      id: activeUser.id,
      username: "alice",
      firstName: "Alice",
      lastName: "Anderson",
      roles: ["ADMIN"],
    });
  });

  it("rejects /auth/me for an inactive user", async () => {
    const { service } = createService({ ...activeUser, active: false });
    await expect(
      service.getAuthenticatedUser(activeUser.id),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("builds secure cookie options aligned with the token TTL", () => {
    const { service } = createService(activeUser);
    const options = service.buildAuthCookieOptions(3600);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
  });

  it("marks the cookie secure only in production", () => {
    const { service } = createService(activeUser);
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      expect(service.buildAuthCookieOptions(60).secure).toBe(true);
      process.env.NODE_ENV = "test";
      expect(service.buildAuthCookieOptions(60).secure).toBe(false);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
