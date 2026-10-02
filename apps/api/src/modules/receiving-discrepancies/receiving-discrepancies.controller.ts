import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import {
  CreateDiscrepancySettlementRequestSchema,
  type CreateDiscrepancySettlementRequest,
  type DiscrepancySettlement,
  type ReceivingDiscrepancyDetail,
  type ReceivingDiscrepancyRegisterRow,
} from "@aitvaras/contracts";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { ReceivingDiscrepanciesService } from "./receiving-discrepancies.service";

/**
 * Receiving discrepancies (`Neatitikimai`) — the long-lived register of
 * documentary/physical mismatches and their append-only settlement ledger.
 *
 * Reading is authenticated; recording a settlement is a documentary/financial
 * ADMIN act. A settlement never changes inventory or the original discrepancy.
 */
@Controller("receiving-discrepancies")
export class ReceivingDiscrepanciesController {
  constructor(
    private readonly receivingDiscrepanciesService: ReceivingDiscrepanciesService,
  ) {}

  @Get()
  list(): Promise<ReceivingDiscrepancyRegisterRow[]> {
    return this.receivingDiscrepanciesService.list();
  }

  @Get(":id")
  get(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ReceivingDiscrepancyDetail> {
    return this.receivingDiscrepanciesService.get(id);
  }

  @Post(":id/settlements")
  @Roles("ADMIN")
  createSettlement(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateDiscrepancySettlementRequestSchema))
    body: CreateDiscrepancySettlementRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<DiscrepancySettlement> {
    return this.receivingDiscrepanciesService.createSettlement(
      id,
      body,
      actor.id,
    );
  }
}
