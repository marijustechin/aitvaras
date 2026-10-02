import { describe, expect, it } from "vitest";
import {
  deliveryCodePrefix,
  formatDeliveryCode,
  MAX_DELIVERY_SEQUENCE,
  parseDeliverySequence,
} from "./delivery-code";

describe("delivery code", () => {
  it("formats GYYMM-NN with a two-digit year, month and sequence", () => {
    expect(formatDeliveryCode(2026, 9, 1)).toBe("G2609-01");
    expect(formatDeliveryCode(2026, 10, 12)).toBe("G2610-12");
    expect(formatDeliveryCode(2027, 1, 5)).toBe("G2701-05");
  });

  it("builds a per-month prefix so the sequence resets each month", () => {
    expect(deliveryCodePrefix(2026, 9)).toBe("G2609-");
    expect(deliveryCodePrefix(2026, 10)).toBe("G2610-");
  });

  it("parses only codes of the requested month", () => {
    expect(parseDeliverySequence("G2609-07", 2026, 9)).toBe(7);
    expect(parseDeliverySequence("G2609-07", 2026, 10)).toBeNull();
    expect(parseDeliverySequence("G2610-03", 2026, 10)).toBe(3);
    expect(parseDeliverySequence("P-2026-000001", 2026, 10)).toBeNull();
  });

  it("caps the monthly sequence at 99", () => {
    expect(MAX_DELIVERY_SEQUENCE).toBe(99);
    expect(formatDeliveryCode(2026, 9, 99)).toBe("G2609-99");
  });
});
