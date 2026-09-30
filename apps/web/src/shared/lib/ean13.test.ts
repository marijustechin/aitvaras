import { describe, expect, it } from "vitest";
import { ean13Modules } from "./ean13";

describe("ean13Modules", () => {
  it("encodes a 13-digit value into 95 modules with EAN-13 guards", () => {
    const modules = ean13Modules("2001234567890");
    expect(modules).not.toBeNull();
    expect(modules).toHaveLength(95);
    expect(modules?.slice(0, 3)).toBe("101");
    expect(modules?.slice(45, 50)).toBe("01010");
    expect(modules?.slice(92, 95)).toBe("101");
  });

  it("encodes an all-zero value deterministically", () => {
    const zeroL = "0001101";
    const zeroR = "1110010";
    const expected = `101${zeroL.repeat(6)}01010${zeroR.repeat(6)}101`;
    expect(ean13Modules("0000000000000")).toBe(expected);
  });

  it("supports every leading-digit parity (2 and 4 differ in the left half)", () => {
    const two = ean13Modules("2111111111111");
    const four = ean13Modules("4111111111111");
    expect(two).toHaveLength(95);
    expect(four).toHaveLength(95);
    expect(two?.slice(3, 45)).not.toBe(four?.slice(3, 45));
  });

  it("returns null for anything other than 13 digits", () => {
    expect(ean13Modules("")).toBeNull();
    expect(ean13Modules("12345")).toBeNull();
    expect(ean13Modules("20012345678900")).toBeNull();
    expect(ean13Modules("200123456789A")).toBeNull();
  });
});
