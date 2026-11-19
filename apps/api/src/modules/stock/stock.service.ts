import { Injectable } from "@nestjs/common";
import type { StockSummary } from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { summarizeStock } from "./stock-summary";

/**
 * Read-only stock summary for the dashboard.
 *
 * No stock-balance/movement tables exist yet. The remaining stock is derived
 * from the current active units of **CONFIRMED** batches only (never from all
 * historical receipts), with `Batch.acquisitionAmount` as the existing cost pool.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<StockSummary> {
    const [weightAggregate, piecesAggregate, confirmedBatches] =
      await this.prisma.$transaction([
        this.prisma.bag.aggregate({
          where: {
            status: "ACTIVE",
            batch: { status: "CONFIRMED", receivingMode: "WEIGHT" },
          },
          _sum: { netWeight: true },
        }),
        this.prisma.batchItem.aggregate({
          where: {
            status: "ACTIVE",
            batch: { status: "CONFIRMED", receivingMode: "PIECE" },
          },
          _sum: { quantity: true },
        }),
        this.prisma.batch.findMany({
          where: { status: "CONFIRMED" },
          select: {
            receivingMode: true,
            acquisitionAmount: true,
            allocatedTransportAmount: true,
            allocatedCustomsAmount: true,
            _count: {
              select: {
                bags: { where: { status: "ACTIVE" } },
                items: { where: { status: "ACTIVE" } },
              },
            },
          },
        }),
      ]);

    return summarizeStock({
      weightKg: weightAggregate._sum.netWeight,
      pieces: piecesAggregate._sum.quantity,
      batches: confirmedBatches.map((batch) => ({
        receivingMode: batch.receivingMode,
        acquisitionAmount: batch.acquisitionAmount,
        allocatedTransportAmount: batch.allocatedTransportAmount,
        allocatedCustomsAmount: batch.allocatedCustomsAmount,
        activeBagCount: batch._count.bags,
        activeItemCount: batch._count.items,
      })),
    });
  }
}
