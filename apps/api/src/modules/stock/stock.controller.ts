import { Controller, Get } from "@nestjs/common";
import type { StockSummary } from "@aitvaras/contracts";
import { StockService } from "./stock.service";

/**
 * Read-only stock summary for authenticated users.
 *
 * Existing permissions are unchanged: quantities and acquisition values are
 * already readable by authenticated users through the batches API; no new
 * permission gate is introduced.
 */
@Controller("stock")
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get("summary")
  summary(): Promise<StockSummary> {
    return this.stockService.summary();
  }
}
