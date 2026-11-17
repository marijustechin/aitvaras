import { ApiError } from "@/shared/api";
import type {
  PartnerFieldErrors,
  PartnerFieldKey,
} from "./partner-form";

const FIELD_KEYS: readonly PartnerFieldKey[] = [
  "name",
  "roles",
  "country",
  "companyCode",
];

function isPartnerField(path: string): path is PartnerFieldKey {
  return (FIELD_KEYS as readonly string[]).includes(path);
}

/**
 * Map structured API validation details to form fields.
 *
 * Duplicate identification arrives as a field-level `companyCode`/`country`
 * conflict, so it renders next to the inputs instead of as a generic failure.
 */
export function partnerFieldErrorsFromApi(
  caught: unknown,
): PartnerFieldErrors | null {
  if (!(caught instanceof ApiError) || !caught.details) {
    return null;
  }
  const errors: PartnerFieldErrors = {};
  for (const detail of caught.details) {
    if (isPartnerField(detail.path) && errors[detail.path] === undefined) {
      errors[detail.path] = detail.message;
    }
  }
  return Object.keys(errors).length > 0 ? errors : null;
}
