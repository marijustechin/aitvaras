import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RoleKey } from "@aitvaras/contracts";
import { describe, expect, it, vi } from "vitest";
import { RolesGuard } from "./roles.guard";

function createContext(user?: { roles: RoleKey[] }): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function createGuard(required: RoleKey[] | undefined) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(required),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe("RolesGuard", () => {
  it("allows routes with no role requirement", () => {
    expect(createGuard(undefined).canActivate(createContext())).toBe(true);
    expect(createGuard([]).canActivate(createContext())).toBe(true);
  });

  it("allows a user holding the required role", () => {
    const guard = createGuard(["ADMIN"]);
    expect(
      guard.canActivate(createContext({ roles: ["ADMIN"] })),
    ).toBe(true);
  });

  it("forbids a user without the required role", () => {
    const guard = createGuard(["ADMIN"]);
    expect(() =>
      guard.canActivate(createContext({ roles: ["WAREHOUSE_WORKER"] })),
    ).toThrow(ForbiddenException);
  });

  it("forbids an unauthenticated request", () => {
    const guard = createGuard(["ADMIN"]);
    expect(() => guard.canActivate(createContext())).toThrow(ForbiddenException);
  });
});
