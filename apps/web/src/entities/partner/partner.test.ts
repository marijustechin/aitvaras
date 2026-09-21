import { describe, expect, it } from "vitest";
import {
  EMPTY_PARTNERS_MESSAGE,
  partnerRoleLabel,
  partnerRoleSummary,
} from "./partner";

describe("partner role mapping", () => {
  it("maps partner role keys to Lithuanian labels", () => {
    expect(partnerRoleLabel("SUPPLIER")).toBe("Tiekėjas");
    expect(partnerRoleLabel("BUYER")).toBe("Pirkėjas");
  });

  it("summarises roles without exposing raw keys", () => {
    expect(partnerRoleSummary(["SUPPLIER", "BUYER"])).toBe("Tiekėjas, Pirkėjas");
    expect(partnerRoleSummary([])).toBe("");
  });

  it("exposes the empty-state text", () => {
    expect(EMPTY_PARTNERS_MESSAGE).toBe("Partnerių dar nėra.");
  });
});
