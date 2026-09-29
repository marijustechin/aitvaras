import { Module } from "@nestjs/common";
import { ResourceCategoriesController } from "./resource-categories.controller";
import { ResourceCategoriesService } from "./resource-categories.service";

@Module({
  controllers: [ResourceCategoriesController],
  providers: [ResourceCategoriesService],
  exports: [ResourceCategoriesService],
})
export class ResourceCategoriesModule {}
