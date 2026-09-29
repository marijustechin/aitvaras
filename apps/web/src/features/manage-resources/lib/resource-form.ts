import type { Resource } from "@aitvaras/contracts";

/** Editable resource form values. `categoryId` is a managed-category reference. */
export interface ResourceFormValues {
  name: string;
  categoryId: string;
  notes: string;
  active: boolean;
}

/** Blank form values for a new resource (defaults to active, no category yet). */
export function emptyResourceFormValues(): ResourceFormValues {
  return { name: "", categoryId: "", notes: "", active: true };
}

/** Map an API resource to editable form values (null becomes an empty string). */
export function resourceToFormValues(resource: Resource): ResourceFormValues {
  return {
    name: resource.name,
    categoryId: resource.categoryId,
    notes: resource.notes ?? "",
    active: resource.active,
  };
}

/** Convert form values into the create/update request payload. */
export function resourceFormToPayload(values: ResourceFormValues): {
  name: string;
  categoryId: string;
  notes: string;
  active: boolean;
} {
  return {
    name: values.name.trim(),
    categoryId: values.categoryId,
    notes: values.notes.trim(),
    active: values.active,
  };
}

/** Client-side validation message keyed to a form problem, or null. */
export function resourceFormError(values: ResourceFormValues): string | null {
  if (values.name.trim() === "") {
    return "Įveskite ištekliaus pavadinimą.";
  }
  if (values.categoryId.trim() === "") {
    return "Pasirinkite kategoriją.";
  }
  return null;
}
