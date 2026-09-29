/**
 * Batch code generation. A batch code is the system-generated, human-readable
 * identifier printed on labels: `P-<year>-<6-digit sequence>`, e.g.
 * `P-2026-000042`. It is sequential per calendar year; uniqueness is guaranteed
 * by the database constraint plus retry on conflict (see BatchesService).
 */
const BATCH_CODE_PREFIX = "P";

export function formatBatchCode(year: number, sequence: number): string {
  return `${BATCH_CODE_PREFIX}-${year}-${String(sequence).padStart(6, "0")}`;
}

/** Parse the sequence number from a batch code of the given year, or null. */
export function parseBatchSequence(code: string, year: number): number | null {
  const prefix = `${BATCH_CODE_PREFIX}-${year}-`;
  if (!code.startsWith(prefix)) {
    return null;
  }
  const sequence = Number.parseInt(code.slice(prefix.length), 10);
  return Number.isFinite(sequence) ? sequence : null;
}
