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

function createService(user: FakeUser | null) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue("signed-token") };
  const config = { get: vi.fn().mockReturnValue("3600") };

  return {
    service: new AuthService(prisma as never, jwt as never, config as never),
    jwt,
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

  it("authenticates valid credentials and issues a token", async () => {
    const { service } = createService(activeUser);

    const result = await service.login("alice", PASSWORD);

    expect(result.accessToken).toBe("signed-token");
    expect(result.tokenType).toBe("Bearer");
    expect(result.expiresIn).toBe(3600);
    expect(result.user).toEqual({
      id: activeUser.id,
      username: "alice",
      firstName: "Alice",
      lastName: "Anderson",
      roles: ["ADMIN"],
    });
  });

  it("rejects a wrong password generically", async () => {
    const { service } = createService(activeUser);
    await expect(service.login("alice", "wrong")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects an unknown user generically", async () => {
    const { service } = createService(null);
    await expect(service.login("nobody", PASSWORD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects an inactive user", async () => {
    const { service } = createService({ ...activeUser, active: false });
    await expect(service.login("alice", PASSWORD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
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
});
