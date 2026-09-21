import type { PrismaClient } from "@aitvaras/database";

/**
 * Currently confirmed packing forms (Pakavimo formos).
 *
 * This is reference/master data, not ordinary end-user content. Extending the
 * list is a deliberate decision and must be re-seeded explicitly.
 */
export const CONFIRMED_PACKING_FORMS = [
  "Dėžė",
  "Maišas",
  "Metalinis narvas",
  "Rulonas",
] as const;

/**
 * Idempotently ensure the confirmed packing forms exist.
 *
 * Safe to run repeatedly: existing forms are left untouched (no duplicates, no
 * renaming, no reactivation). Returns how many rows were created.
 */
export async function ensureConfirmedPackingForms(
  prisma: PrismaClient,
): Promise<number> {
  let created = 0;
  for (const name of CONFIRMED_PACKING_FORMS) {
    const existing = await prisma.packingForm.findUnique({ where: { name } });
    if (existing) {
      continue;
    }
    await prisma.packingForm.create({ data: { name } });
    created += 1;
  }
  return created;
}
