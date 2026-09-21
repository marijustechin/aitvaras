import type { Resource, ResourceCategoryKey } from "@aitvaras/contracts";

/** Editable resource form values. */
export interface ResourceFormValues {
  name: string;
  category: ResourceCategoryKey;
  notes: string;
  active: boolean;
}

/** Blank form values for a new resource (defaults to active, first category). */
export function emptyResourceFormValues(): ResourceFormValues {
  return { name: "", category: "RAW_MATERIAL", notes: "", active: true };
}

/** Map an API resource to editable form values (null becomes an empty string). */
export function resourceToFormValues(resource: Resource): ResourceFormValues {
  return {
    name: resource.name,
    category: resource.category,
    notes: resource.notes ?? "",
    active: resource.active,
  };
}

/** Convert form values into the create/update request payload. */
export function resourceFormToPayload(values: ResourceFormValues): {
  name: string;
  category: ResourceCategoryKey;
  notes: string;
  active: boolean;
} {
  return {
    name: values.name.trim(),
    category: values.category,
    notes: values.notes.trim(),
    active: values.active,
  };
}

/** Client-side validation message keyed to a form problem, or null. */
export function resourceFormError(values: ResourceFormValues): string | null {
  if (values.name.trim() === "") {
    return "Įveskite ištekliaus pavadinimą.";
  }
  return null;
}
