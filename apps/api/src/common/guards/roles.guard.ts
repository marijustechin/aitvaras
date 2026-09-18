import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RoleKey } from "@aitvaras/contracts";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthenticatedUser } from "./authenticated-user";

/**
 * Global role guard. Runs after `JwtAuthGuard`.
 *
 * Routes without `@Roles(...)` metadata require no specific role (but still
 * require authentication unless `@Public()`). Routes with roles require the
 * user to hold at least one of them.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleKey[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || !required.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return true;
  }
}
