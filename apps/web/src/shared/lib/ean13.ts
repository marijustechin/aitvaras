/**
 * Minimal EAN-13 encoder for label rendering.
 *
 * Aitvaras bag barcodes are 13-digit EAN-13-shaped values; this turns 13 digits
 * into the 95-module bit pattern (`1` = bar, `0` = space) that a renderer draws.
 * It does not validate the check digit — the value is opaque and already unique.
 */
const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
] as const;
const G = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
] as const;
const R = [
  "1110010",
  "1100110",
  "1101100",
  "1000010",
  "1011100",
  "1001110",
  "1010000",
  "1000100",
  "1001000",
  "1110100",
] as const;
/** Left-hand L/G parity per leading digit. */
const PARITY = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
] as const;

/**
 * Encode a 13-digit value into 95 EAN-13 modules, or `null` when the value is
 * not exactly 13 digits.
 */
export function ean13Modules(value: string): string | null {
  if (!/^\d{13}$/.test(value)) {
    return null;
  }
  const digitAt = (index: number): number => value.charCodeAt(index) - 48;
  const parity = PARITY[digitAt(0)];
  if (!parity) {
    return null;
  }

  let modules = "101";
  for (let index = 0; index < 6; index += 1) {
    const digit = digitAt(index + 1);
    modules += (parity[index] === "L" ? L[digit] : G[digit]) ?? "";
  }
  modules += "01010";
  for (let index = 0; index < 6; index += 1) {
    modules += R[digitAt(index + 7)] ?? "";
  }
  modules += "101";
  return modules;
}
