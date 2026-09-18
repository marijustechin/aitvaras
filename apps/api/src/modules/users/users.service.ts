import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@aitvaras/database";
import type {
  CreateUserRequest,
  RoleKey,
  UpdateUserRequest,
  UserSummary,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { hashPassword } from "../auth/password";
import { toUserSummary } from "./user.mapper";

const withRoles = {
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;

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
    const roleIds = await this.resolveRoleIds(input.roles);
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
        throw new ConflictException("Username already exists");
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateUserRequest): Promise<UserSummary> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("User not found");
    }

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
    if (input.password !== undefined) {
      data.passwordHash = await hashPassword(input.password);
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.user.update({ where: { id }, data });
      }
      if (input.roles !== undefined) {
        const roleIds = await this.resolveRoleIds(input.roles, tx);
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
