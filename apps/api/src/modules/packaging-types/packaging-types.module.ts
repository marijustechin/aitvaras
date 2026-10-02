import { Module } from "@nestjs/common";
import { PackagingTypesController } from "./packaging-types.controller";
import { PackagingTypesService } from "./packaging-types.service";

@Module({
  controllers: [PackagingTypesController],
  providers: [PackagingTypesService],
})
export class PackagingTypesModule {}
