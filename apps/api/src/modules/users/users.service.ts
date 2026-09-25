import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@aitvaras/database";
import {
  USER_PASSWORD_RESET_ERROR_CODES,
  normalizeRoleKeys,
  type CreateUserRequest,
  type RoleKey,
  type UpdateUserRequest,
  type UserSummary,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { hashPassword } from "../auth/password";
import { toUserSummary } from "./user.mapper";

const withRoles = {
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;

const LAST_ACTIVE_ADMIN_DEACTIVATE =
  "Negalima išjungti paskutinio aktyvaus administratoriaus.";
const LAST_ACTIVE_ADMIN_ROLE =
  "Negalima pašalinti paskutinio aktyvaus administratoriaus vaidmens.";
const SELF_ADMIN_CHANGE =
  "Negalima atimti administratoriaus teisių ar išjungti savo paskyros.";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<UserSummary[]> {
    const users = await this.prisma.user.findMany({
      include: withRoles,
      orderBy: { username: "asc" },
    });
    return users.map(toUserSummary);
  }

  async create(input: CreateUserRequest): Promise<UserSummary> {
    // ADMIN dominates: a redundant ADMIN + other role set is stored as ADMIN.
    const roleIds = await this.resolveRoleIds(normalizeRoleKeys(input.roles));
    const passwordHash = await hashPassword(input.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash,
          active: input.active ?? true,
          roles: { create: roleIds.map((roleId) => ({ roleId })) },
        },
        include: withRoles,
      });
      return toUserSummary(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Naudotojas tokiu vardu jau egzistuoja.");
      }
      throw error;
    }
  }

  async update(
    actorId: string,
    id: string,
    input: UpdateUserRequest,
  ): Promise<UserSummary> {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: withRoles,
    });
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    await this.assertAdministrativeSafety(actorId, existing, input);

    const data: Prisma.UserUpdateInput = {};
    if (input.firstName !== undefined) {
      data.firstName = input.firstName;
    }
    if (input.lastName !== undefined) {
      data.lastName = input.lastName;
    }
    if (input.active !== undefined) {
      data.active = input.active;
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.user.update({ where: { id }, data });
      }
      if (input.roles !== undefined) {
        const roleIds = await this.resolveRoleIds(
          normalizeRoleKeys(input.roles),
          tx,
        );
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (roleIds.length > 0) {
          await tx.userRole.createMany({
            data: roleIds.map((roleId) => ({ userId: id, roleId })),
          });
        }
      }
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: withRoles,
    });
    return toUserSummary(user);
  }

  /**
   * Administrator-driven password reset.
   *
   * Sets a new password for the target user and bumps their `tokenVersion`,
   * which invalidates every access token already issued to that user. The old
   * password is never accepted, read or returned. There is no email recovery
   * flow and no reset token.
   *
   * If the administrator resets their own password, their current token is
   * invalidated too (they must sign in again); resetting another user does not
   * affect the administrator's session.
   */
  async resetPassword(id: string, password: string): Promise<UserSummary> {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: USER_PASSWORD_RESET_ERROR_CODES.USER_NOT_FOUND,
        message: "Naudotojas nerastas.",
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await this.prisma.user.update({
      where: { id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
      include: withRoles,
    });
    return toUserSummary(user);
  }

  /**
   * Authorization safety rules for user updates.
   *
   * - The system must never end up with zero active ADMIN users.
   * - An admin must not remove their own admin access or deactivate their own
   *   account (session cookies are not invalidated when `active` changes, so
   *   self-deactivation would leave an incoherent session).
   */
  private async assertAdministrativeSafety(
    actorId: string,
    existing: { id: string; active: boolean; roles: { role: { key: string } }[] },
    input: UpdateUserRequest,
  ): Promise<void> {
    const currentRoles = existing.roles.map(
      (assignment) => assignment.role.key as RoleKey,
    );
    if (!existing.active || !currentRoles.includes("ADMIN")) {
      return;
    }

    const nextRoles =
      input.roles !== undefined ? normalizeRoleKeys(input.roles) : currentRoles;
    const losesAdmin = !nextRoles.includes("ADMIN");
    const deactivates = input.active === false;
    if (!losesAdmin && !deactivates) {
      return;
    }

    const otherActiveAdmins = await this.prisma.user.count({
      where: {
        active: true,
        id: { not: existing.id },
        roles: { some: { role: { key: "ADMIN" } } },
      },
    });

    if (otherActiveAdmins === 0) {
      throw new ConflictException(
        deactivates ? LAST_ACTIVE_ADMIN_DEACTIVATE : LAST_ACTIVE_ADMIN_ROLE,
      );
    }

    if (existing.id === actorId) {
      throw new ConflictException(SELF_ADMIN_CHANGE);
    }
  }

  private async resolveRoleIds(
    keys: RoleKey[],
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string[]> {
    const roles = await client.role.findMany({
      where: { key: { in: keys } },
    });
    if (roles.length !== keys.length) {
      const found = new Set(roles.map((role) => role.key));
      const missing = keys.filter((key) => !found.has(key));
      throw new BadRequestException(
        `Unknown role(s): ${missing.join(", ") || "unknown"}`,
      );
    }
    return roles.map((role) => role.id);
  }
}

/**
 * Detect a Prisma unique-constraint violation without depending on a specific
 * error class (stable across Prisma majors).
 */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
