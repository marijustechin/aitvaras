/**
 * Focus the first invalid field for a failed action, keeping the user's entered
 * values intact. `preventScroll` avoids a jump; the element is then centred and
 * the reduced-motion preference is respected.
 */
export function focusField(id: string | null | undefined): void {
  if (!id) {
    return;
  }
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    return;
  }
  element.focus({ preventScroll: true });
  element.scrollIntoView({
    block: "center",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}

/** Concise summary for multiple invalid fields; one field keeps its message. */
export function invalidFieldsSummary(
  errors: Partial<Record<string, string | undefined>>,
  labels: Record<string, string>,
): string | null {
  const keys = Object.keys(errors).filter((key) => errors[key]);
  if (keys.length === 0) {
    return null;
  }
  if (keys.length === 1) {
    return errors[keys[0] as keyof typeof errors] ?? null;
  }
  return `Patikrinkite laukus: ${keys
    .map((key) => labels[key] ?? key)
    .join(", ")}.`;
}
