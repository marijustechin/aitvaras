import { EMPTY_VALUE } from "./format";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function partsToIso(parts: DateParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Parse a strict `yyyy-mm-dd` value, validating the real calendar day. */
export function parseDateOnly(value: string): DateParts | null {
  const match = DATE_ONLY.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(utc.getTime()) ||
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** True only for an existing `yyyy-mm-dd` calendar date. */
export function isValidDateOnly(value: string): boolean {
  return parseDateOnly(value) !== null;
}

/**
 * Local calendar date of a date-only value or timestamp (`yyyy-mm-dd`).
 *
 * Date-only values are returned untouched. Timestamps use **local** date
 * components so an arrival stored as local midnight does not move to the
 * previous/next day through UTC conversion. Empty/invalid input returns `""`.
 */
export function isoDatePart(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (parseDateOnly(trimmed)) {
    return trimmed;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return partsToIso({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

/** User-visible date (`yyyy-mm-dd`) or the empty placeholder. */
export function formatDate(value: string | null | undefined): string {
  return isoDatePart(value) || EMPTY_VALUE;
}

/**
 * User-visible timestamp with a consistently formatted date portion:
 * `yyyy-mm-dd HH:mm`. Date-only values have no time and are shown as a date.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return EMPTY_VALUE;
  }
  const trimmed = value.trim();
  const date = isoDatePart(trimmed);
  if (parseDateOnly(trimmed)) {
    return date || EMPTY_VALUE;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return EMPTY_VALUE;
  }
  return `${date} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

/** Local today as `yyyy-mm-dd` (never via UTC). */
export function todayDateOnly(): string {
  const now = new Date();
  return partsToIso({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  });
}

/**
 * Progressive manual entry for the date input: keeps only digits and inserts
 * `yyyy-mm-dd` separators. Incomplete values stay incomplete for validation.
 */
export function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/**
 * Convert a date-only `yyyy-mm-dd` value to an ISO timestamp at local start of
 * day. Returns `null` for an invalid date. This preserves the calendar day for
 * the API while never inventing a time zone.
 */
export function dateOnlyToLocalIso(value: string): string | null {
  const parts = parseDateOnly(value);
  if (!parts) {
    return null;
  }
  const date = new Date(parts.year, parts.month - 1, parts.day);
  if (
    date.getFullYear() !== parts.year ||
    date.getMonth() !== parts.month - 1 ||
    date.getDate() !== parts.day
  ) {
    return null;
  }
  return date.toISOString();
}

/** Lithuanian month + year label for the date picker. */
export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("lt-LT", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export const WEEKDAY_SHORT_LABELS = ["Pr", "An", "Tr", "Kt", "Pn", "Št", "Sk"] as const;

/** Day cells (Monday-first) for a month; `null` pads the first week. */
export function monthGrid(year: number, month: number): Array<number | null> {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<number | null> = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }
  return cells;
}

/** Shift a year/month pair by a number of months. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}
