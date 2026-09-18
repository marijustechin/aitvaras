import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import {
  LoginRequestSchema,
  type AuthenticatedUser,
  type LoginRequest,
  type LoginResponse,
} from "@aitvaras/contracts";
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
  login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
  ): Promise<LoginResponse> {
    return this.authService.login(body.username, body.password);
  }

  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthenticatedUser> {
    return this.authService.getAuthenticatedUser(user.id);
  }
}
