import { describe, expect, it } from "vitest";
import {
  dateOnlyToLocalIso,
  formatDate,
  formatDateInput,
  formatDateTime,
  isoDatePart,
  isValidDateOnly,
  monthGrid,
  parseDateOnly,
  shiftMonth,
  todayDateOnly,
} from "./date";

describe("date-only validation and formatting", () => {
  it("accepts only real yyyy-mm-dd calendar dates", () => {
    expect(isValidDateOnly("2026-11-18")).toBe(true);
    expect(isValidDateOnly("2024-02-29")).toBe(true);
    expect(isValidDateOnly("2026-02-30")).toBe(false);
    expect(isValidDateOnly("18.11.2026")).toBe(false);
    expect(isValidDateOnly("2026-1-8")).toBe(false);
    expect(isValidDateOnly("")).toBe(false);
  });

  it("formats date-only values without timezone conversion", () => {
    expect(formatDate("2026-11-18")).toBe("2026-11-18");
    expect(isoDatePart("2026-11-18")).toBe("2026-11-18");
    expect(formatDate(null)).toBe("—");
  });

  it("derives the local date of a timestamp without moving the day", () => {
    const localMidnight = new Date(2026, 10, 18, 0, 0, 0, 0);
    expect(isoDatePart(localMidnight.toISOString())).toBe("2026-11-18");
    expect(formatDate(localMidnight.toISOString())).toBe("2026-11-18");
  });

  it("keeps the time portion in yyyy-mm-dd HH:mm", () => {
    const local = new Date(2026, 10, 18, 9, 5, 0, 0);
    expect(formatDateTime(local.toISOString())).toBe("2026-11-18 09:05");
    expect(formatDateTime("2026-11-18")).toBe("2026-11-18");
  });

  it("formats progressive manual entry", () => {
    expect(formatDateInput("2026")).toBe("2026");
    expect(formatDateInput("202611")).toBe("2026-11");
    expect(formatDateInput("20261118")).toBe("2026-11-18");
    expect(formatDateInput("2026-11-18")).toBe("2026-11-18");
    expect(formatDateInput("abc")).toBe("");
    expect(formatDateInput("")).toBe("");
  });

  it("converts a date-only value to local start of day and back", () => {
    const iso = dateOnlyToLocalIso("2026-11-18");
    expect(iso).not.toBeNull();
    expect(isoDatePart(iso)).toBe("2026-11-18");
    expect(dateOnlyToLocalIso("2026-02-30")).toBeNull();
  });

  it("returns today as a date-only value", () => {
    expect(isValidDateOnly(todayDateOnly())).toBe(true);
  });
});

describe("calendar helpers", () => {
  it("builds a Monday-first month grid", () => {
    // November 2026 starts on Sunday and has 30 days.
    const grid = monthGrid(2026, 11);
    expect(grid.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(grid[6]).toBe(1);
    expect(grid.filter((day) => day !== null)).toHaveLength(30);
  });

  it("shifts across year boundaries", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("parses parts for valid dates", () => {
    expect(parseDateOnly("2026-11-18")).toEqual({
      year: 2026,
      month: 11,
      day: 18,
    });
  });
});
