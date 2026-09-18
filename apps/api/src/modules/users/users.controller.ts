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
  UpdateUserRequestSchema,
  type CreateUserRequest,
  type UpdateUserRequest,
  type UserSummary,
} from "@aitvaras/contracts";
import { Roles } from "../../common/decorators/roles.decorator";
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
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUserRequestSchema))
    body: UpdateUserRequest,
  ): Promise<UserSummary> {
    return this.usersService.update(id, body);
  }
}
