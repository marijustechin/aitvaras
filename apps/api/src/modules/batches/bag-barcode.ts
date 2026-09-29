import { randomInt } from "node:crypto";

/**
 * Barcode generation for physical bags.
 *
 * The code is EAN-13-shaped (13 digits) using the GS1 "20" restricted-
 * circulation prefix followed by 10 random digits and a valid check digit. It
 * identifies ONE physical unit and deliberately encodes NO business data
 * (supplier, resource, date, batch, cost); relationships provide that meaning.
 * Uniqueness is guaranteed by the database constraint plus retry on conflict.
 */
export function ean13CheckDigit(base: string): number {
  if (!/^\d{12}$/.test(base)) {
    throw new Error("EAN-13 base must be exactly 12 digits");
  }
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(base[index]);
    sum += index % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function generateBagBarcode(
  randomDigit: () => number = () => randomInt(0, 10),
): string {
  let base = "20";
  for (let index = 0; index < 10; index += 1) {
    base += String(randomDigit());
  }
  return `${base}${ean13CheckDigit(base)}`;
}
