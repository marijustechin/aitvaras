import { describe, expect, it } from "vitest";
import type { Partner } from "@aitvaras/contracts";
import {
  EMPTY_PARTNERS_MESSAGE,
  activeSuppliers,
  isActiveSupplier,
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

function partner(
  id: string,
  roles: Partner["roles"],
  active = true,
): Partner {
  return {
    id,
    name: id,
    companyCode: null,
    vatCode: null,
    address: null,
    country: null,
    contactPerson: null,
    phone: null,
    email: null,
    notes: null,
    roles,
    active,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("active suppliers", () => {
  it("accepts active SUPPLIER and SUPPLIER+BUYER partners", () => {
    expect(isActiveSupplier(partner("s", ["SUPPLIER"]))).toBe(true);
    expect(isActiveSupplier(partner("sb", ["SUPPLIER", "BUYER"]))).toBe(true);
  });

  it("rejects buyer-only and inactive partners", () => {
    expect(isActiveSupplier(partner("b", ["BUYER"]))).toBe(false);
    expect(isActiveSupplier(partner("i", ["SUPPLIER"], false))).toBe(false);
  });

  it("filters a partner list down to active suppliers", () => {
    const selected = activeSuppliers([
      partner("s", ["SUPPLIER"]),
      partner("b", ["BUYER"]),
      partner("i", ["SUPPLIER"], false),
    ]);
    expect(selected.map((item) => item.id)).toEqual(["s"]);
  });
});
