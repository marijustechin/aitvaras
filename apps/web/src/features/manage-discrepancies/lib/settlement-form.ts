import {
  DEFAULT_DISCREPANCY_CURRENCY,
  type CreateDiscrepancySettlementRequest,
  type DiscrepancySettlementType,
} from "@aitvaras/contracts";

/** The settlement entry form draft. */
export interface SettlementDraft {
  type: DiscrepancySettlementType;
  coveredWeightKg: string;
  moneyAmount: string;
  currency: string;
  sourceBatchId: string;
  reference: string;
  note: string;
}

export function createSettlementDraft(): SettlementDraft {
  return {
    type: "WEIGHT",
    coveredWeightKg: "",
    moneyAmount: "",
    currency: DEFAULT_DISCREPANCY_CURRENCY,
    sourceBatchId: "",
    reference: "",
    note: "",
  };
}

function isPositiveNumber(value: string): boolean {
  if (value.trim() === "") {
    return false;
  }
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

/**
 * Client-side validation. `remainingWeight` is the server-derived remaining
 * magnitude (kg); the server re-validates transactionally (the client value is a
 * convenience only).
 */
export function settlementFormError(
  draft: SettlementDraft,
  remainingWeight: string,
): string | null {
  if (!isPositiveNumber(draft.coveredWeightKg)) {
    return "Įveskite teigiamą padengiamą svorį.";
  }
  const covered = Number(draft.coveredWeightKg);
  const remaining = Number(remainingWeight);
  if (Number.isFinite(remaining) && covered > remaining) {
    return "Padengiamas svoris viršija likutį.";
  }
  if (draft.type === "MONEY") {
    if (!isPositiveNumber(draft.moneyAmount)) {
      return "Įveskite teigiamą sumą.";
    }
    if (draft.currency.trim() === "") {
      return "Įveskite valiutą.";
    }
  }
  return null;
}

/** Build the request payload for the selected settlement type. */
export function toCreateSettlementPayload(
  draft: SettlementDraft,
): CreateDiscrepancySettlementRequest {
  const base = {
    type: draft.type,
    coveredWeightKg: draft.coveredWeightKg.trim(),
    reference: draft.reference.trim() || undefined,
    note: draft.note.trim() || undefined,
  };
  if (draft.type === "MONEY") {
    return {
      ...base,
      moneyAmount: draft.moneyAmount.trim(),
      currency: draft.currency.trim(),
    };
  }
  return draft.sourceBatchId
    ? { ...base, sourceBatchId: draft.sourceBatchId }
    : base;
}
