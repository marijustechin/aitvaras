import { z } from "zod";

/**
 * Shared password policy (minimum length and bound).
 *
 * Used wherever a plaintext password is accepted (user creation and the
 * administrator password reset) so the rule is defined once.
 */
export const PasswordSchema = z.string().min(6).max(200);

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
