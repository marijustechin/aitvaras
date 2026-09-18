import { describe, expect, it } from "vitest";
import { ROLE_KEYS } from "@aitvaras/contracts";
import { $Enums } from "@aitvaras/database";

describe("role catalogue", () => {
  it("keeps the contracts ROLE_KEYS in sync with the Prisma RoleKey enum", () => {
    const contractKeys = [...ROLE_KEYS].sort();
    const databaseKeys = [...Object.values($Enums.RoleKey)].sort();
    expect(contractKeys).toEqual(databaseKeys);
  });
});
