import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  CreateUserRequestSchema,
  ResetUserPasswordRequestSchema,
  UpdateUserRequestSchema,
  type AuthenticatedUser,
  type CreateUserRequest,
  type ResetUserPasswordRequest,
  type UpdateUserRequest,
  type UserSummary,
} from "@aitvaras/contracts";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { UsersService } from "./users.service";

/** User administration. Admin-only. */
@Controller("users")
@Roles("ADMIN")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(): Promise<UserSummary[]> {
    return this.usersService.list();
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateUserRequestSchema))
    body: CreateUserRequest,
  ): Promise<UserSummary> {
    return this.usersService.create(body);
  }

  @Patch(":id")
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUserRequestSchema))
    body: UpdateUserRequest,
  ): Promise<UserSummary> {
    return this.usersService.update(actor.id, id, body);
  }

  /**
   * Set a new password for another user (admin-only). Returns the safe user
   * summary; the password/hash is never returned. Existing sessions of the
   * target user are invalidated.
   */
  @Patch(":id/password")
  resetPassword(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ResetUserPasswordRequestSchema))
    body: ResetUserPasswordRequest,
  ): Promise<UserSummary> {
    return this.usersService.resetPassword(id, body.password);
  }
}
