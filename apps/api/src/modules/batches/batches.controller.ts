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
  CreateBagRequestSchema,
  CreateBatchRequestSchema,
  ReconcileBatchRequestSchema,
  UpdateBagRequestSchema,
  VoidBagRequestSchema,
  type Bag,
  type Batch,
  type BatchDetail,
  type BatchReconciliation,
  type BatchStatus,
  type CreateBagRequest,
  type CreateBatchRequest,
  type ReconcileBatchRequest,
  type UpdateBagRequest,
  type VoidBagRequest,
} from "@aitvaras/contracts";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { BatchesService } from "./batches.service";

/**
 * Batches (Partijos) and their bags (Maišai).
 *
 * Reading requires authentication only. Starting a batch, adding bags and
 * correcting/voiding a unit are operational warehouse actions, allowed for ADMIN
 * and warehouse workers. Formal reconciliation with a GoodsReceipt is a
 * documentary/financial act and is ADMIN-only. Bags are never deleted — an
 * erroneous unit is voided and preserved.
 */
@Controller("batches")
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  list(@Query("status") status?: string): Promise<Batch[]> {
    return this.batchesService.list(this.parseStatus(status));
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<BatchDetail> {
    return this.batchesService.get(id);
  }

  @Post()
  @Roles("ADMIN", "WAREHOUSE_WORKER")
  create(
    @Body(new ZodValidationPipe(CreateBatchRequestSchema))
    body: CreateBatchRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Batch> {
    return this.batchesService.create(body, actor.id);
  }

  @Get(":id/bags")
  listBags(@Param("id", ParseUUIDPipe) id: string): Promise<Bag[]> {
    return this.batchesService.listBags(id);
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
  ): Promise<BatchReconciliation> {
    return this.batchesService.reconcile(id, body);
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
