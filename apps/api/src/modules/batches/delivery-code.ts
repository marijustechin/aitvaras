/**
 * Incoming-delivery code generation. A delivery code is the compact, human-facing
 * identifier printed on labels and shown in the receiving UI:
 * `G<YY><MM>-<NN>`, e.g. `G2609-01`.
 *
 * `YY`/`MM` are the two-digit year/month of the calendar month the code is
 * generated in; `NN` is a two-digit sequence within that month, resetting each
 * month. The sequence never exceeds 99 (no silent `100`). The code encodes no
 * business data; uniqueness is guaranteed by the database constraint plus retry
 * on conflict (see DeliveriesService).
 */
const DELIVERY_CODE_PREFIX = "G";
export const MAX_DELIVERY_SEQUENCE = 99;

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/** The `G<YY><MM>-` prefix for a calendar month. */
export function deliveryCodePrefix(year: number, month: number): string {
  return `${DELIVERY_CODE_PREFIX}${twoDigits(year % 100)}${twoDigits(month)}-`;
}

/** Format a delivery code `G<YY><MM>-<NN>` for a calendar month and sequence. */
export function formatDeliveryCode(
  year: number,
  month: number,
  sequence: number,
): string {
  return `${deliveryCodePrefix(year, month)}${twoDigits(sequence)}`;
}

/**
 * Parse the sequence number from a delivery code of the given calendar month, or
 * null when the code does not belong to that month.
 */
export function parseDeliverySequence(
  code: string,
  year: number,
  month: number,
): number | null {
  const prefix = deliveryCodePrefix(year, month);
  if (!code.startsWith(prefix)) {
    return null;
  }
  const sequence = Number.parseInt(code.slice(prefix.length), 10);
  return Number.isFinite(sequence) ? sequence : null;
}
