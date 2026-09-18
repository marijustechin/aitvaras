import { describe, expect, it } from "vitest";
import { ROLE_KEYS, ROLE_LABELS } from "./roles";

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
