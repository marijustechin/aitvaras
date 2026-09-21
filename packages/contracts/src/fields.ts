import { z } from "zod";

/**
 * Optional free-text field. Trims; an explicit empty string clears the value
 * (`null`), an absent field is left unchanged (`undefined`).
 */
export function optionalTextField(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .optional();
}
