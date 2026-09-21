import { describe, expect, it } from "vitest";
import { ROLE_KEYS, ROLE_LABELS, normalizeRoleKeys } from "./roles";

describe("role labels", () => {
  it("provides a non-empty Lithuanian label for every role key", () => {
    for (const key of ROLE_KEYS) {
      expect(typeof ROLE_LABELS[key]).toBe("string");
      expect(ROLE_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it("does not expose the raw role key as its label", () => {
    for (const key of ROLE_KEYS) {
      expect(ROLE_LABELS[key]).not.toBe(key);
    }
  });
});

describe("normalizeRoleKeys", () => {
  it("lets ADMIN dominate and persist alone", () => {
    expect(normalizeRoleKeys(["ADMIN", "ACCOUNTING"])).toEqual(["ADMIN"]);
    expect(normalizeRoleKeys(["ACCOUNTING", "ADMIN"])).toEqual(["ADMIN"]);
    expect(normalizeRoleKeys(["ADMIN", "ADMIN"])).toEqual(["ADMIN"]);
  });

  it("de-duplicates non-admin roles in catalogue order", () => {
    expect(
      normalizeRoleKeys(["PRODUCTION_MANAGER", "ACCOUNTING", "ACCOUNTING"]),
    ).toEqual(["ACCOUNTING", "PRODUCTION_MANAGER"]);
  });

  it("keeps a single role and an empty set unchanged", () => {
    expect(normalizeRoleKeys(["WAREHOUSE_WORKER"])).toEqual(["WAREHOUSE_WORKER"]);
    expect(normalizeRoleKeys([])).toEqual([]);
  });
});
