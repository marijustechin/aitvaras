import { z } from "zod";
import { RoleKeySchema } from "./roles";

/** Credentials submitted to `POST /auth/login`. */
export const LoginRequestSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Safe representation of the authenticated user. Never includes secrets. */
export const AuthenticatedUserSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  roles: z.array(RoleKeySchema),
});
export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;

/** Successful login response. The access token is delivered via an httpOnly
 * cookie and is deliberately NOT part of this payload. */
export const LoginResponseSchema = z.object({
  user: AuthenticatedUserSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/** Successful logout response. */
export const LogoutResponseSchema = z.object({
  success: z.literal(true),
});
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;

const NamePartSchema = z.string().trim().min(1).max(100);

/**
 * Self-service profile update for the currently authenticated user.
 *
 * The server derives the user from the authenticated identity, so no user id is
 * accepted. Only name and password are editable; username, roles and active
 * state are deliberately not part of this contract (unknown keys are rejected).
 */
export const UpdateOwnProfileRequestSchema = z
  .object({
    firstName: NamePartSchema.optional(),
    lastName: NamePartSchema.optional(),
    currentPassword: z.string().min(1).max(200).optional(),
    newPassword: z.string().min(8).max(200).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.newPassword !== undefined,
    { message: "Nothing to update" },
  )
  .refine(
    (value) =>
      value.newPassword === undefined || value.currentPassword !== undefined,
    { message: "Current password is required to change the password" },
  );
export type UpdateOwnProfileRequest = z.infer<
  typeof UpdateOwnProfileRequestSchema
>;
