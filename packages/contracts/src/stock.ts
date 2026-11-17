import { z } from "zod";

/**
 * Dashboard stock summary.
 *
 * Quantities come only from **confirmed** receiving batches:
 * - weight = active packages' net weight (`kg`, decimal string);
 * - pieces = active PIECE item lines' quantity (`vnt.`, integer).
 *
 * `value` is the remaining acquisition cost in EUR, or `null` when stock exists
 * but no known valuation is available. `valuationIncomplete` is true when at least
 * one included batch has no `acquisitionAmount`; the known value (if any) is still
 * returned and missing costs are never silently treated as zero.
 */
export const StockSummarySchema = z.object({
  weight: z.object({
    quantityKg: z.string(),
    value: z.string().nullable(),
    valuationIncomplete: z.boolean(),
  }),
  pieces: z.object({
    quantity: z.number().int().nonnegative(),
    value: z.string().nullable(),
    valuationIncomplete: z.boolean(),
  }),
});

export type StockSummary = z.infer<typeof StockSummarySchema>;
