import { describe, expect, it } from "vitest";
import {
  CreateUserRequestSchema,
  ResetUserPasswordRequestSchema,
  UpdateUserRequestSchema,
  USER_PASSWORD_RESET_ERROR_CODES,
} from "./users";

describe("ResetUserPasswordRequestSchema", () => {
  it("accepts a valid password payload", () => {
    const result = ResetUserPasswordRequestSchema.safeParse({
      password: "new-password-123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts the shared 6-character minimum", () => {
    const result = ResetUserPasswordRequestSchema.safeParse({ password: "abcdef" });
    expect(result.success).toBe(true);
  });

  it("rejects a too-short password (5 characters)", () => {
    const result = ResetUserPasswordRequestSchema.safeParse({ password: "abcde" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty or missing password", () => {
    expect(ResetUserPasswordRequestSchema.safeParse({}).success).toBe(false);
    expect(
      ResetUserPasswordRequestSchema.safeParse({ password: "" }).success,
    ).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    const result = ResetUserPasswordRequestSchema.safeParse({
      password: "new-password-123",
      // no old password / token / email fields are part of this contract
      oldPassword: "irrelevant",
    });
    expect(result.success).toBe(false);
  });

  it("exposes stable error codes", () => {
    expect(USER_PASSWORD_RESET_ERROR_CODES).toEqual({
      VALIDATION_ERROR: "VALIDATION_ERROR",
      USER_NOT_FOUND: "USER_NOT_FOUND",
      FORBIDDEN: "FORBIDDEN",
    });
  });
});

describe("UpdateUserRequestSchema", () => {
  it("no longer accepts a password (separate action)", () => {
    const result = UpdateUserRequestSchema.safeParse({
      password: "new-password-123",
    });
    expect(result.success).toBe(false);
  });

  it("still accepts name/role/active updates", () => {
    expect(
      UpdateUserRequestSchema.safeParse({ firstName: "Jonas" }).success,
    ).toBe(true);
    expect(
      UpdateUserRequestSchema.safeParse({ active: false }).success,
    ).toBe(true);
  });
});

describe("CreateUserRequestSchema password policy", () => {
  it("enforces the shared minimum length", () => {
    const base = {
      username: "jonas",
      firstName: "Jonas",
      lastName: "Jonaitis",
      roles: ["ACCOUNTING"],
    };
    expect(
      CreateUserRequestSchema.safeParse({ ...base, password: "abcde" }).success,
    ).toBe(false);
    expect(
      CreateUserRequestSchema.safeParse({ ...base, password: "abcdef" }).success,
    ).toBe(true);
  });
});
