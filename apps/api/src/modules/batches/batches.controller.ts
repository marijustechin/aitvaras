import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  BatchStatusSchema,
  ConfirmPieceBatchRequestSchema,
  CreateBagRequestSchema,
  CreateBatchItemRequestSchema,
  ReconcileBatchRequestSchema,
  UpdateBagRequestSchema,
  UpdateBatchItemRequestSchema,
  UpdateBatchRegistrationRequestSchema,
  VoidBagRequestSchema,
  VoidBatchItemRequestSchema,
  type Bag,
  type Batch,
  type BatchDetail,
  type BatchItem,
  type BatchPieceConfirmation,
  type BatchReconciliation,
  type BatchStatus,
  type ConfirmPieceBatchRequest,
  type CreateBagRequest,
  type CreateBatchItemRequest,
  type ReconcileBatchRequest,
  type UpdateBagRequest,
  type UpdateBatchItemRequest,
  type UpdateBatchRegistrationRequest,
  type VoidBagRequest,
  type VoidBatchItemRequest,
} from "@aitvaras/contracts";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { BatchesService } from "./batches.service";
import { redactBatch, redactBatchDetail } from "./batch-redaction";

/**
 * Batches (Partijos) and their bags (Maišai).
 *
 * A batch is the internal, homogeneous resource/unit group inside an
 * IncomingDelivery (`Gavimas`); it is started/resolved through the delivery
 * endpoints (`DeliveriesController`). Reading requires authentication only.
 * Adding bags and correcting/voiding a unit are operational warehouse actions,
 * allowed for ADMIN and warehouse workers. Formal reconciliation with a
 * GoodsReceipt is a documentary/financial act and is ADMIN-only. Bags are never
 * deleted — an erroneous unit is voided and preserved.
 */
@Controller("batches")
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query("status") status?: string,
  ): Promise<Batch[]> {
    const batches = await this.batchesService.list(this.parseStatus(status));
    return batches.map((batch) => redactBatch(batch, actor));
  }

  @Get(":id")
  async get(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<BatchDetail> {
    return redactBatchDetail(await this.batchesService.get(id), actor);
  }

  @Get(":id/bags")
  listBags(@Param("id", ParseUUIDPipe) id: string): Promise<Bag[]> {
    return this.batchesService.listBags(id);
  }

  @Get(":id/items")
  listItems(@Param("id", ParseUUIDPipe) id: string): Promise<BatchItem[]> {
    return this.batchesService.listItems(id);
  }

  @Patch(":id/registration")
  @Roles("ADMIN", "WAREHOUSE_WORKER")
  async updateRegistration(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateBatchRegistrationRequestSchema))
    body: UpdateBatchRegistrationRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<BatchDetail> {
    return redactBatchDetail(
      await this.batchesService.updateRegistration(id, body, actor.id),
      actor,
    );
  }

  @Post(":id/items")
  @Roles("ADMIN", "WAREHOUSE_WORKER")
  addItem(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateBatchItemRequestSchema))
    body: CreateBatchItemRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<BatchItem> {
    return this.batchesService.addItem(id, body, actor.id);
  }

  @Patch(":id/items/:itemId")
  @Roles("ADMIN", "WAREHOUSE_WORKER")
  correctItem(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body(new ZodValidationPipe(UpdateBatchItemRequestSchema))
    body: UpdateBatchItemRequest,
  ): Promise<BatchItem> {
    return this.batchesService.correctItem(id, itemId, body);
  }

  @Post(":id/items/:itemId/void")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "WAREHOUSE_WORKER")
  voidItem(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body(new ZodValidationPipe(VoidBatchItemRequestSchema))
    body: VoidBatchItemRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<BatchItem> {
    return this.batchesService.voidItem(id, itemId, body, actor.id);
  }

  @Post(":id/bags")
  @Roles("ADMIN", "WAREHOUSE_WORKER")
  createBag(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateBagRequestSchema))
    body: CreateBagRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Bag> {
    return this.batchesService.createBag(id, body, actor.id);
  }

  @Patch(":id/bags/:bagId")
  @Roles("ADMIN", "WAREHOUSE_WORKER")
  correctBag(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("bagId", ParseUUIDPipe) bagId: string,
    @Body(new ZodValidationPipe(UpdateBagRequestSchema))
    body: UpdateBagRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Bag> {
    return this.batchesService.correctBag(id, bagId, body, actor.id);
  }

  @Post(":id/bags/:bagId/void")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "WAREHOUSE_WORKER")
  voidBag(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("bagId", ParseUUIDPipe) bagId: string,
    @Body(new ZodValidationPipe(VoidBagRequestSchema))
    body: VoidBagRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Bag> {
    return this.batchesService.voidBag(id, bagId, body, actor.id);
  }

  @Post(":id/reconcile")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  reconcile(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReconcileBatchRequestSchema))
    body: ReconcileBatchRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<BatchReconciliation> {
    return this.batchesService.reconcile(id, body, actor.id);
  }

  @Post(":id/confirm-piece")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  confirmPiece(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ConfirmPieceBatchRequestSchema))
    body: ConfirmPieceBatchRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<BatchPieceConfirmation> {
    return this.batchesService.confirmPiece(id, body, actor.id);
  }

  private parseStatus(status?: string): BatchStatus | undefined {
    if (status === undefined || status === "") {
      return undefined;
    }
    const result = BatchStatusSchema.safeParse(status);
    if (!result.success) {
      throw new BadRequestException("Neteisinga partijos būsena.");
    }
    return result.data;
  }
}
