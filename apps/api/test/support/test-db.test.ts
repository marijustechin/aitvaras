import { describe, expect, it, vi } from "vitest";
import {
  assertTestDatabase,
  databaseNameOf,
  resolveTestDatabaseUrl,
  TEST_DATABASE_NAME,
} from "./test-db";

describe("test database safety", () => {
  it("parses the database name from a connection URL", () => {
    expect(
      databaseNameOf("postgresql://u:p@127.0.0.1:5432/aitvaras_test?schema=public"),
    ).toBe("aitvaras_test");
    expect(databaseNameOf("not-a-url")).toBeUndefined();
  });

  it("accepts the dedicated test database", () => {
    expect(() =>
      assertTestDatabase("postgresql://u:p@127.0.0.1:5432/aitvaras_test"),
    ).not.toThrow();
  });

  it("refuses the development database", () => {
    expect(() =>
      assertTestDatabase("postgresql://u:p@127.0.0.1:5432/aitvaras"),
    ).toThrow(/not the test database/);
  });

  it("refuses an unknown database", () => {
    expect(() =>
      assertTestDatabase("postgresql://u:p@127.0.0.1:5432/whatever"),
    ).toThrow(/not the test database/);
  });

  it("throws when TEST_DATABASE_URL is missing (no dev fallback)", () => {
    const previous = process.env.TEST_DATABASE_URL;
    try {
      delete process.env.TEST_DATABASE_URL;
      // Prevent loadTestEnv from re-reading `.env` during the assertion.
      const loadEnvFile = process.loadEnvFile;
      process.loadEnvFile = vi.fn();
      try {
        expect(() => resolveTestDatabaseUrl()).toThrow(/TEST_DATABASE_URL is not set/);
      } finally {
        process.loadEnvFile = loadEnvFile;
      }
      expect(TEST_DATABASE_NAME).toBe("aitvaras_test");
    } finally {
      if (previous === undefined) {
        delete process.env.TEST_DATABASE_URL;
      } else {
        process.env.TEST_DATABASE_URL = previous;
      }
    }
  });
});
