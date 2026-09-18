import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type {
  AuthenticatedUser,
  LoginResponse,
  RoleKey,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { verifyPassword } from "./password";

const DEFAULT_ACCESS_TTL_SECONDS = 3600;

interface UserWithRoles {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  active: boolean;
  roles: { role: { key: string } }[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get accessTtlSeconds(): number {
    const raw = this.config.get<string>("JWT_ACCESS_TTL");
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_ACCESS_TTL_SECONDS;
  }

  /**
   * Validate credentials. Failure is deliberately generic so callers cannot
   * distinguish an unknown user from a wrong password.
   */
  async validateCredentials(
    username: string,
    password: string,
  ): Promise<UserWithRoles> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return user;
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const user = await this.validateCredentials(username, password);
    const tokens = this.toAuthenticatedUser(user);

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, username: user.username, roles: tokens.roles },
      { expiresIn: this.accessTtlSeconds },
    );

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.accessTtlSeconds,
      user: tokens,
    };
  }

  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException("Authentication required");
    }
    return this.toAuthenticatedUser(user);
  }

  private toAuthenticatedUser(user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    roles: { role: { key: string } }[];
  }): AuthenticatedUser {
    const roles = user.roles
      .map((assignment) => assignment.role.key as RoleKey)
      .sort();
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
    };
  }
}
