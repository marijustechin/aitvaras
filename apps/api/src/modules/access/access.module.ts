import { Module } from "@nestjs/common";
import { InitialRolesService } from "./initial-roles.service";

/**
 * Access domain module: role definitions/configuration and access-control
 * primitives that belong to the access domain.
 *
 * The generic guards/decorators live in `common/` (cross-cutting security
 * primitives); this module owns the role catalogue.
 */
@Module({
  providers: [InitialRolesService],
})
export class AccessModule {}
