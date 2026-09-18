import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import { JwtAuthGuard } from "./jwt-auth.guard";

interface RequestStub {
  headers: Record<string, string | undefined>;
  user?: unknown;
}

function createContext(request: RequestStub): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createGuard(isPublic: boolean, verifyResult?: unknown) {
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
  return { guard: new JwtAuthGuard(reflector, jwt), verifyAsync };
}

describe("JwtAuthGuard", () => {
  it("allows public routes without a token", async () => {
    const { guard } = createGuard(true);
    await expect(guard.canActivate(createContext({ headers: {} }))).resolves.toBe(
      true,
    );
  });

  it("rejects a request without an Authorization header", async () => {
    const { guard } = createGuard(false);
    await expect(
      guard.canActivate(createContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a malformed Authorization header", async () => {
    const { guard } = createGuard(false);
    await expect(
      guard.canActivate(createContext({ headers: { authorization: "Token abc" } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects an invalid or expired token", async () => {
    const { guard } = createGuard(false, new Error("jwt expired"));
    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: "Bearer bad.token" } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("attaches the user on a valid token", async () => {
    const request: RequestStub = {
      headers: { authorization: "Bearer good.token" },
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
});
