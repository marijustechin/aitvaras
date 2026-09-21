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
