import { z } from "zod";
import { PasswordSchema } from "./fields";
import { RoleKeySchema } from "./roles";

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

/** A person's name part. Non-empty, trimmed, bounded. */
const NamePartSchema = z.string().trim().min(1).max(100);

/** Safe user representation returned by the users API. Never includes secrets. */
export const UserSummarySchema = z.object({
  id: z.uuid(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  roles: z.array(RoleKeySchema),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

/** Admin request to create a user. */
export const CreateUserRequestSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(64)
    .regex(USERNAME_PATTERN, "Use letters, digits, dot, underscore or hyphen"),
  firstName: NamePartSchema,
  lastName: NamePartSchema,
  password: PasswordSchema,
  roles: z.array(RoleKeySchema).min(1),
  active: z.boolean().optional(),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

/**
 * Admin request to update a user's name, roles or active state.
 *
 * Deliberately excludes `password`: changing a password is a separate action
 * (`PATCH /users/:id/password`). Unknown fields (including `password`) are
 * rejected so the workflows cannot be confused.
 */
export const UpdateUserRequestSchema = z
  .object({
    firstName: NamePartSchema.optional(),
    lastName: NamePartSchema.optional(),
    roles: z.array(RoleKeySchema).min(1).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.roles !== undefined ||
      value.active !== undefined,
    {
      message:
        "At least one field (firstName, lastName, roles, active) must be provided",
    },
  );
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

/**
 * Administrator request to set a new password for another user.
 *
 * The old password is never submitted, requested or returned. There is no email
 * recovery flow and no reset token. On success the target user's existing
 * sessions are invalidated (their token version is bumped).
 */
export const ResetUserPasswordRequestSchema = z
  .object({
    password: PasswordSchema,
  })
  .strict();
export type ResetUserPasswordRequest = z.infer<
  typeof ResetUserPasswordRequestSchema
>;

/**
 * Stable, machine-readable error codes for the administrator password-reset
 * action, so clients never parse human messages. Insufficient permissions is a
 * role-guard failure and is reported as HTTP `403`.
 */
export const USER_PASSWORD_RESET_ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
} as const;
export type UserPasswordResetErrorCode =
  (typeof USER_PASSWORD_RESET_ERROR_CODES)[keyof typeof USER_PASSWORD_RESET_ERROR_CODES];
