import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@aitvaras/database";
import {
  type CreateDiscrepancySettlementRequest,
  type DiscrepancySettlement,
  type ReceivingDiscrepancyDetail,
  type ReceivingDiscrepancyRegisterRow,
  type ReceivingDiscrepancyStatus,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  discrepancyDetailInclude,
  discrepancyListInclude,
  settlementBalance,
  settlementInclude,
  toDetail,
  toRegisterRow,
  toSettlement,
} from "./discrepancy.mapper";

/**
 * The receiving-discrepancy register and its append-only settlement ledger.
 *
 * A discrepancy is created by batch reconciliation (`BatchesService`) and is the
 * long-lived anchor: `differenceWeight = measuredWeight − documentWeight` is
 * immutable. Settlements record how the original magnitude is resolved — by
 * additional physical weight (`WEIGHT`) or by a money/credit agreement (`MONEY`).
 * A settlement **never** touches inventory: it does not change any bag/batch
 * weight, does not create or remove stock, and does not reopen confirmation. Money
 * is never converted to/from kg — the ADMIN enters both the covered weight and the
 * money amount.
 */
@Injectable()
export class ReceivingDiscrepanciesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The register, newest first, with derived balances. */
  async list(): Promise<ReceivingDiscrepancyRegisterRow[]> {
    const rows = await this.prisma.receivingDiscrepancy.findMany({
      include: discrepancyListInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(toRegisterRow);
  }

  /** One discrepancy with its immutable origin summary and settlement history. */
  async get(id: string): Promise<ReceivingDiscrepancyDetail> {
    const row = await this.prisma.receivingDiscrepancy.findUnique({
      where: { id },
      include: discrepancyDetailInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "DISCREPANCY_NOT_FOUND",
        message: "Neatitikimas nerastas.",
      });
    }
    return toDetail(row);
  }

  /**
   * Record a settlement. Validated and applied transactionally: the discrepancy
   * row is locked, the already-settled weight is re-derived server-side, and the
   * new entry must not exceed the remaining magnitude (concurrent requests cannot
   * over-settle). The signed difference and the physical inventory are untouched.
   */
  async createSettlement(
    discrepancyId: string,
    input: CreateDiscrepancySettlementRequest,
    actorId: string,
  ): Promise<DiscrepancySettlement> {
    const coveredWeightKg = parsePositiveDecimal(
      input.coveredWeightKg,
      "Įveskite teigiamą padengiamą svorį.",
    );

    let moneyAmount: Prisma.Decimal | null = null;
    let currency: string | null = null;
    if (input.type === "MONEY") {
      if (!input.moneyAmount) {
        throw invalid("Įveskite padengiamą sumą.");
      }
      moneyAmount = parsePositiveDecimal(
        input.moneyAmount,
        "Įveskite teigiamą sumą.",
      );
      if (!input.currency) {
        throw invalid("Įveskite valiutą.");
      }
      currency = input.currency;
    } else if (input.moneyAmount || input.currency) {
      throw invalid("Svorio padengimas neturi sumos ar valiutos.");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      // Serialize concurrent settlements for the same discrepancy so the balance
      // cannot be over-covered by two racing requests.
      await tx.$queryRaw`SELECT "id" FROM "receiving_discrepancies" WHERE "id" = ${discrepancyId}::uuid FOR UPDATE`;

      const discrepancy = await tx.receivingDiscrepancy.findUnique({
        where: { id: discrepancyId },
        include: { settlements: { select: { coveredWeightKg: true } } },
      });
      if (!discrepancy) {
        throw new NotFoundException({
          code: "DISCREPANCY_NOT_FOUND",
          message: "Neatitikimas nerastas.",
        });
      }

      const balance = settlementBalance(
        discrepancy.differenceWeight,
        discrepancy.settlements,
      );
      if (balance.remainingWeight.lte(0)) {
        throw new ConflictException({
          code: "DISCREPANCY_ALREADY_SETTLED",
          message: "Neatitikimas jau visiškai padengtas.",
        });
      }
      if (coveredWeightKg.gt(balance.remainingWeight)) {
        throw new ConflictException({
          code: "SETTLEMENT_EXCEEDS_REMAINING",
          message: `Padengiamas svoris viršija likutį (${balance.remainingWeight.toString()} kg).`,
        });
      }

      if (input.sourceBatchId) {
        const source = await tx.batch.findUnique({
          where: { id: input.sourceBatchId },
          select: {
            status: true,
            delivery: { select: { supplierId: true } },
          },
        });
        if (!source) {
          throw invalid("Susijusi partija nerasta.", "SOURCE_BATCH_NOT_FOUND");
        }
        if (source.status !== "CONFIRMED") {
          throw invalid(
            "Susijusi partija turi būti patvirtinta.",
            "SOURCE_BATCH_NOT_CONFIRMED",
          );
        }
        if (source.delivery.supplierId !== discrepancy.supplierId) {
          throw invalid(
            "Susijusi partija priklauso kitam tiekėjui.",
            "SOURCE_BATCH_SUPPLIER_MISMATCH",
          );
        }
      }

      const settlement = await tx.discrepancySettlement.create({
        data: {
          discrepancyId,
          type: input.type,
          coveredWeightKg,
          moneyAmount,
          currency,
          sourceBatchId: input.sourceBatchId ?? null,
          reference: input.reference ?? null,
          note: input.note ?? null,
          createdById: actorId,
        },
        include: settlementInclude,
      });

      const settledWeight = balance.settledWeight.plus(coveredWeightKg);
      const remainingWeight = balance.originalWeight.minus(settledWeight);
      const status: ReceivingDiscrepancyStatus = remainingWeight.lte(0)
        ? "SETTLED"
        : settledWeight.gt(0)
          ? "PARTIALLY_SETTLED"
          : "OPEN";

      await tx.receivingDiscrepancy.update({
        where: { id: discrepancyId },
        data: {
          status,
          settledAt:
            status === "SETTLED"
              ? (discrepancy.settledAt ?? new Date())
              : discrepancy.settledAt,
        },
      });

      return settlement;
    });

    return toSettlement(created);
  }
}

function invalid(message: string, code = "INVALID_SETTLEMENT"): BadRequestException {
  return new BadRequestException({ code, message });
}

function parsePositiveDecimal(value: string, message: string): Prisma.Decimal {
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(value);
  } catch {
    throw invalid(message);
  }
  if (!decimal.isFinite() || decimal.lte(0)) {
    throw invalid(message);
  }
  return decimal;
}
