import { Controller, Get, Param } from "@nestjs/common";
import type { Bag } from "@aitvaras/contracts";
import { BatchesService } from "./batches.service";

/**
 * Bags (Maišai) addressed by their unique barcode. Bags are owned by a batch,
 * so creation lives under `/batches/:id/bags`; this controller only exposes the
 * scanner lookup (`GET /bags/by-barcode/:barcode`).
 */
@Controller("bags")
export class BagsController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get("by-barcode/:barcode")
  getByBarcode(@Param("barcode") barcode: string): Promise<Bag> {
    return this.batchesService.getBagByBarcode(barcode);
  }
}
