import { z } from "zod";
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
  password: z.string().min(8).max(200),
  roles: z.array(RoleKeySchema).min(1),
  active: z.boolean().optional(),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

/** Admin request to update a user's name, roles, active state or password. */
export const UpdateUserRequestSchema = z
  .object({
    firstName: NamePartSchema.optional(),
    lastName: NamePartSchema.optional(),
    roles: z.array(RoleKeySchema).min(1).optional(),
    active: z.boolean().optional(),
    password: z.string().min(8).max(200).optional(),
  })
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.roles !== undefined ||
      value.active !== undefined ||
      value.password !== undefined,
    {
      message:
        "At least one field (firstName, lastName, roles, active, password) must be provided",
    },
  );
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;
