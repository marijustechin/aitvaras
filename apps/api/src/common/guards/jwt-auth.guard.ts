import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { RoleKey } from "@aitvaras/contracts";
import { AUTH_COOKIE_NAME } from "../auth/auth-cookie";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthenticatedUser } from "./authenticated-user";

interface JwtPayload {
  sub: string;
  username: string;
  roles?: RoleKey[];
}

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  user?: AuthenticatedUser;
}

/**
 * Global authentication guard.
 *
 * Rejects unauthenticated requests by default; routes marked `@Public()` are
 * exempt. On success it attaches the authenticated user to the request.
 *
 * Token sources, in priority order:
 *  1. the httpOnly `aitvaras_access` cookie (canonical browser authentication);
 *  2. an `Authorization: Bearer <jwt>` header (kept for API clients/tooling;
 *     the browser never uses this).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Authentication required");
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      request.user = {
        id: payload.sub,
        username: payload.username,
        roles: payload.roles ?? [],
      };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const cookieToken = request.cookies?.[AUTH_COOKIE_NAME];
    if (cookieToken) {
      return cookieToken;
    }

    const header = request.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (value && value.startsWith("Bearer ")) {
      const bearer = value.slice("Bearer ".length).trim();
      return bearer || undefined;
    }
    return undefined;
  }
}
