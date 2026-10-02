import type {
  CreatePackagingTypeRequest,
  UpdatePackagingTypeRequest,
} from "@aitvaras/contracts";

/** A packaging type being created/edited in the form (tare is a string). */
export interface DraftPackagingType {
  name: string;
  tareWeightKg: string;
}

/** A non-negative decimal with at most 3 decimals (`0` and `0.000` allowed). */
const TARE = /^\d+(\.\d{1,3})?$/;

/** A blank packaging-type draft. */
export function createDraftPackagingType(): DraftPackagingType {
  return { name: "", tareWeightKg: "" };
}

/** Client-side validation message, or null when the draft is submittable. */
export function packagingTypeFormError(
  draft: DraftPackagingType,
): string | null {
  if (draft.name.trim() === "") {
    return "Įveskite taros pavadinimą.";
  }
  const tare = draft.tareWeightKg.trim();
  if (!TARE.test(tare)) {
    return "Įveskite taros svorį kg (pvz., 0.800).";
  }
  return null;
}

/** Convert the draft into the create request payload. */
export function toCreatePackagingTypePayload(
  draft: DraftPackagingType,
): CreatePackagingTypeRequest {
  return {
    name: draft.name.trim(),
    tareWeightKg: draft.tareWeightKg.trim(),
  };
}

/** Convert the draft into the update (edit) request payload. */
export function toUpdatePackagingTypePayload(
  draft: DraftPackagingType,
): UpdatePackagingTypeRequest {
  return {
    name: draft.name.trim(),
    tareWeightKg: draft.tareWeightKg.trim(),
  };
}
