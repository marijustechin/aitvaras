import { Module } from "@nestjs/common";
import { BagsController } from "./bags.controller";
import { BatchesController } from "./batches.controller";
import { BatchesService } from "./batches.service";

@Module({
  controllers: [BatchesController, BagsController],
  providers: [BatchesService],
  exports: [BatchesService],
})
export class BatchesModule {}
