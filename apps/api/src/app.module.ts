import { join } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { AccessModule } from "./modules/access/access.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { PackingFormsModule } from "./modules/packing-forms/packing-forms.module";
import { PartnersModule } from "./modules/partners/partners.module";
import { ReceiptsModule } from "./modules/receipts/receipts.module";
import { ResourcesModule } from "./modules/resources/resources.module";
import { UsersModule } from "./modules/users/users.module";
import { WarehousesModule } from "./modules/warehouses/warehouses.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), "../../.env"),
        join(process.cwd(), ".env"),
      ],
    }),
    PrismaModule,
    AccessModule,
    AuthModule,
    UsersModule,
    PartnersModule,
    ResourcesModule,
    PackingFormsModule,
    ReceiptsModule,
    WarehousesModule,
    HealthModule,
  ],
  providers: [
    // Order matters: authenticate first, then authorise by role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
