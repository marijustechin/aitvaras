import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { ensureInitialRoles } from "./role-catalog";

/** Ensures the initial role catalogue exists when the application starts. */
@Injectable()
export class InitialRolesService implements OnModuleInit {
  private readonly logger = new Logger(InitialRolesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await ensureInitialRoles(this.prisma);
    this.logger.log("Initial role catalogue ensured");
  }
}
