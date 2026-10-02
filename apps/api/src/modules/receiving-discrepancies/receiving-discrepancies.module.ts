import { Module } from "@nestjs/common";
import { ReceivingDiscrepanciesController } from "./receiving-discrepancies.controller";
import { ReceivingDiscrepanciesService } from "./receiving-discrepancies.service";

@Module({
  controllers: [ReceivingDiscrepanciesController],
  providers: [ReceivingDiscrepanciesService],
})
export class ReceivingDiscrepanciesModule {}
