import { Module } from "@nestjs/common";
import { PackingFormsController } from "./packing-forms.controller";
import { PackingFormsService } from "./packing-forms.service";

@Module({
  controllers: [PackingFormsController],
  providers: [PackingFormsService],
  exports: [PackingFormsService],
})
export class PackingFormsModule {}
