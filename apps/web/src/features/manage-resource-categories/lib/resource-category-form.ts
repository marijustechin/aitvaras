/** Editable resource-category form values. */
export interface ResourceCategoryFormValues {
  name: string;
  active: boolean;
}

/** Blank form values for a new category (defaults to active). */
export function emptyResourceCategoryFormValues(): ResourceCategoryFormValues {
  return { name: "", active: true };
}

/** Client-side validation message, or null. */
export function resourceCategoryFormError(
  values: ResourceCategoryFormValues,
): string | null {
  if (values.name.trim() === "") {
    return "Įveskite kategorijos pavadinimą.";
  }
  return null;
}

/** Convert form values into the create/update request payload. */
export function resourceCategoryFormToPayload(
  values: ResourceCategoryFormValues,
): { name: string; active: boolean } {
  return { name: values.name.trim(), active: values.active };
}
