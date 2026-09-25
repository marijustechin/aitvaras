import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import { AUTH_COOKIE_NAME } from "../auth/auth-cookie";
import { JwtAuthGuard } from "./jwt-auth.guard";

interface RequestStub {
  headers: Record<string, string | undefined>;
  cookies?: Record<string, string | undefined>;
  user?: unknown;
}

function createContext(request: RequestStub): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createGuard(
  isPublic: boolean,
  verifyResult?: unknown,
  options: { tokenVersion?: number; userFound?: boolean } = {},
) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
  const verifyAsync = vi.fn();
  if (verifyResult instanceof Error) {
    verifyAsync.mockRejectedValue(verifyResult);
  } else {
    verifyAsync.mockResolvedValue(verifyResult);
  }
  const jwt = { verifyAsync } as unknown as JwtService;
  const tokenVersion = options.tokenVersion ?? 0;
  const userFound = options.userFound ?? true;
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(userFound ? { tokenVersion } : null),
    },
  };
  return {
    guard: new JwtAuthGuard(reflector, jwt, prisma as never),
    verifyAsync,
    prisma,
  };
}

describe("JwtAuthGuard", () => {
  it("allows public routes without a token", async () => {
    const { guard } = createGuard(true);
    await expect(guard.canActivate(createContext({ headers: {} }))).resolves.toBe(
      true,
    );
  });

  it("authenticates from the auth cookie", async () => {
    const request: RequestStub = {
      headers: {},
      cookies: { [AUTH_COOKIE_NAME]: "cookie.token" },
    };
    const { guard } = createGuard(false, {
      sub: "user-1",
      username: "alice",
      roles: ["ADMIN"],
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: "user-1",
      username: "alice",
      roles: ["ADMIN"],
    });
  });

  it("prefers the cookie over a bearer header", async () => {
    const { guard, verifyAsync } = createGuard(false, {
      sub: "user-cookie",
      username: "alice",
      roles: ["ADMIN"],
    });

    await guard.canActivate(
      createContext({
        headers: { authorization: "Bearer header.token" },
        cookies: { [AUTH_COOKIE_NAME]: "cookie.token" },
      }),
    );

    expect(verifyAsync).toHaveBeenCalledWith("cookie.token");
  });

  it("still accepts a bearer header for API/tooling clients", async () => {
    const { guard, verifyAsync } = createGuard(false, {
      sub: "user-bearer",
      username: "tool",
      roles: [],
    });

    await guard.canActivate(
      createContext({ headers: { authorization: "Bearer header.token" } }),
    );

    expect(verifyAsync).toHaveBeenCalledWith("header.token");
  });

  it("accepts a token whose version matches the user's current version", async () => {
    const tokenVersion = 3;
    const { guard } = createGuard(
      false,
      { sub: "user-1", username: "alice", roles: ["ADMIN"], ver: tokenVersion },
      { tokenVersion },
    );

    await expect(
      guard.canActivate(
        createContext({ headers: {}, cookies: { [AUTH_COOKIE_NAME]: "t" } }),
      ),
    ).resolves.toBe(true);
  });

  it("rejects a token issued before a password reset (stale version)", async () => {
    const { guard } = createGuard(
      false,
      { sub: "user-1", username: "alice", roles: ["ADMIN"], ver: 0 },
      { tokenVersion: 1 },
    );

    await expect(
      guard.canActivate(
        createContext({ headers: {}, cookies: { [AUTH_COOKIE_NAME]: "t" } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a token for a user that no longer exists", async () => {
    const { guard } = createGuard(
      false,
      { sub: "user-gone", username: "gone", roles: [] },
      { userFound: false },
    );

    await expect(
      guard.canActivate(
        createContext({ headers: {}, cookies: { [AUTH_COOKIE_NAME]: "t" } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a request without any token", async () => {
    const { guard } = createGuard(false);
    await expect(
      guard.canActivate(createContext({ headers: {}, cookies: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a malformed Authorization header without a cookie", async () => {
    const { guard } = createGuard(false);
    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: "Token abc" }, cookies: {} }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects an invalid or expired token", async () => {
    const { guard } = createGuard(false, new Error("jwt expired"));
    await expect(
      guard.canActivate(
        createContext({
          headers: {},
          cookies: { [AUTH_COOKIE_NAME]: "bad.token" },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
