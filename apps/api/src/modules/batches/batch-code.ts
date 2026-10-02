/**
 * Batch code generation. A batch code is the compact, **delivery-local**
 * human-facing identifier `P<NN>` (e.g. `P01`), scoped to one IncomingDelivery and
 * reset for each new delivery. The IncomingDelivery code is the primary
 * human-facing identifier (e.g. `G2610-01 / P01`); the batch UUID is the true
 * technical identity.
 *
 * The sequence never exceeds `99` (no silent `P100`); uniqueness within a delivery
 * is guaranteed by the `(deliveryId, code)` constraint plus retry on conflict (see
 * BatchesService).
 */
const BATCH_CODE_PREFIX = "P";

/** Maximum delivery-local batch sequence (`P99`). */
export const MAX_BATCH_SEQUENCE = 99;

/** Format a delivery-local batch code `P<NN>` (e.g. `1` -> `P01`). */
export function formatBatchCode(sequence: number): string {
  return `${BATCH_CODE_PREFIX}${String(sequence).padStart(2, "0")}`;
}

/** Parse the delivery-local sequence from a batch code (`P01` -> 1), or null. */
export function parseBatchSequence(code: string): number | null {
  if (!code.startsWith(BATCH_CODE_PREFIX)) {
    return null;
  }
  const sequence = Number.parseInt(code.slice(BATCH_CODE_PREFIX.length), 10);
  return Number.isFinite(sequence) ? sequence : null;
}
