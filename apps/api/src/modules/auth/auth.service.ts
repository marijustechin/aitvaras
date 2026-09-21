import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { CookieSerializeOptions } from "@fastify/cookie";
import type { AuthenticatedUser, RoleKey } from "@aitvaras/contracts";
import { AUTH_COOKIE_PATH } from "../../common/auth/auth-cookie";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { LoginAttemptService } from "./login-attempt.service";
import { verifyPassword } from "./password";

const DEFAULT_ACCESS_TTL_SECONDS = 3600;
const GENERIC_LOGIN_FAILURE = "Invalid credentials";

export interface AuthLoginResult {
  user: AuthenticatedUser;
  accessToken: string;
  expiresIn: number;
}

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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly loginAttempts: LoginAttemptService,
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
   * distinguish an unknown user from a wrong password or an inactive account.
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
      throw new UnauthorizedException(GENERIC_LOGIN_FAILURE);
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException(GENERIC_LOGIN_FAILURE);
    }
    return user;
  }

  /**
   * Authenticate and issue an access token.
   *
   * Brute-force protection is applied per username and per client IP. Locked
   * attempts fail with the same generic error, so an attacker cannot tell
   * whether an account exists or is temporarily locked. The caller is
   * responsible for delivering the token via an httpOnly cookie.
   */
  async login(
    username: string,
    password: string,
    ip?: string,
  ): Promise<AuthLoginResult> {
    const keys = this.attemptKeys(username, ip);

    if (this.loginAttempts.isLocked(keys)) {
      this.logger.warn("Login rejected: too many failed attempts (locked)");
      throw new UnauthorizedException(GENERIC_LOGIN_FAILURE);
    }

    let user: UserWithRoles;
    try {
      user = await this.validateCredentials(username, password);
    } catch (error) {
      this.loginAttempts.recordFailure(keys);
      this.logger.warn("Login rejected: invalid credentials");
      throw error instanceof UnauthorizedException
        ? error
        : new UnauthorizedException(GENERIC_LOGIN_FAILURE);
    }

    this.loginAttempts.reset(keys);

    const authenticatedUser = this.toAuthenticatedUser(user);
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        username: user.username,
        roles: authenticatedUser.roles,
      },
      { expiresIn: this.accessTtlSeconds },
    );

    this.logger.log("Login succeeded");
    return {
      user: authenticatedUser,
      accessToken,
      expiresIn: this.accessTtlSeconds,
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

  /**
   * Cookie attributes for the access token.
   *
   * HttpOnly (no JS access), SameSite=Lax (same-site browser app; see
   * docs/authentication.md for the CSRF reasoning), Secure in production, and
   * an expiry aligned with the token TTL.
   */
  buildAuthCookieOptions(expiresInSeconds: number): CookieSerializeOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: AUTH_COOKIE_PATH,
      maxAge: expiresInSeconds,
    };
  }

  private attemptKeys(username: string, ip?: string): string[] {
    const keys = [`user:${username.trim().toLowerCase()}`];
    if (ip) {
      keys.push(`ip:${ip}`);
    }
    return keys;
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
