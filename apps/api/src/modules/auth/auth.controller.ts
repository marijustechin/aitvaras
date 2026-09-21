import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Post,
  Res,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import {
  LoginRequestSchema,
  type AuthenticatedUser,
  type LoginRequest,
  type LoginResponse,
  type LogoutResponse,
} from "@aitvaras/contracts";
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_PATH,
} from "../../common/auth/auth-cookie";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
    @Ip() ip: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResponse> {
    const { user, accessToken, expiresIn } = await this.authService.login(
      body.username,
      body.password,
      ip,
    );

    reply.setCookie(
      AUTH_COOKIE_NAME,
      accessToken,
      this.authService.buildAuthCookieOptions(expiresIn),
    );

    // The raw token is never returned to the browser; only safe user data.
    return { user };
  }

  @Public()
  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) reply: FastifyReply): LogoutResponse {
    reply.clearCookie(AUTH_COOKIE_NAME, { path: AUTH_COOKIE_PATH });
    return { success: true };
  }

  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthenticatedUser> {
    return this.authService.getAuthenticatedUser(user.id);
  }
}
