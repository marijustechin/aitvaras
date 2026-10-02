import { Module } from "@nestjs/common";
import { BagsController } from "./bags.controller";
import { BatchesController } from "./batches.controller";
import { BatchesService } from "./batches.service";
import { DeliveriesController } from "./deliveries.controller";

@Module({
  controllers: [BatchesController, BagsController, DeliveriesController],
  providers: [BatchesService],
  exports: [BatchesService],
})
export class BatchesModule {}
