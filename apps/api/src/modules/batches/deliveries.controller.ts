import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import {
  CreateIncomingDeliveryRequestSchema,
  ResolveBatchRequestSchema,
  UpdateDeliveryExpensesRequestSchema,
  type BatchDetail,
  type CreateIncomingDeliveryRequest,
  type ApplyDeliveryExpensesResponse,
  type DeliveryExpensePreview,
  type DeliveryExpenses,
  type IncomingDelivery,
  type IncomingDeliveryDetail,
  type ResolveBatchRequest,
  type UpdateDeliveryExpensesRequest,
} from "@aitvaras/contracts";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { BatchesService } from "./batches.service";
import { redactBatch, redactBatchDetail } from "./batch-redaction";

/**
 * Incoming deliveries (Gavimai) — one physical arrival of one supplier into one
 * warehouse, containing one or more homogeneous batches. Buttons and labels use
 * the delivery code `GYYMM-NN` as the human-facing reference.
 *
 * Reading requires authentication only. Starting a delivery and starting/
 * resolving a resource batch inside it are operational warehouse actions,
 * allowed for ADMIN and warehouse workers. Handling units are registered under
 * `/batches/:id/bags`; formal reconciliation under `/batches/:id/reconcile`.
 */
@Controller("deliveries")
export class DeliveriesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  list(): Promise<IncomingDelivery[]> {
    return this.batchesService.listDeliveries();
  }

  @Get(":id")
  async get(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<IncomingDeliveryDetail> {
    const delivery = await this.batchesService.getDelivery(id);
    return {
      ...delivery,
      batches: delivery.batches.map((batch) => redactBatch(batch, actor)),
    };
  }

  @Post()
  @Roles("ADMIN", "WAREHOUSE_WORKER")
  create(
    @Body(new ZodValidationPipe(CreateIncomingDeliveryRequestSchema))
    body: CreateIncomingDeliveryRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<IncomingDelivery> {
    return this.batchesService.createDelivery(body, actor.id);
  }

  @Post(":id/batches")
  @Roles("ADMIN", "WAREHOUSE_WORKER")
  async resolveBatch(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ResolveBatchRequestSchema))
    body: ResolveBatchRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<BatchDetail> {
    return redactBatchDetail(
      await this.batchesService.resolveBatch(id, body, actor.id),
      actor,
    );
  }

  @Get(":id/expenses")
  @Roles("ADMIN")
  getExpenses(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<DeliveryExpenses> {
    return this.batchesService.getDeliveryExpenses(id);
  }

  @Put(":id/expenses")
  @Roles("ADMIN")
  updateExpenses(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateDeliveryExpensesRequestSchema))
    body: UpdateDeliveryExpensesRequest,
  ): Promise<DeliveryExpenses> {
    return this.batchesService.updateDeliveryExpenses(id, body);
  }

  @Post(":id/expenses/preview")
  @Roles("ADMIN")
  previewExpenses(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateDeliveryExpensesRequestSchema))
    body: UpdateDeliveryExpensesRequest,
  ): Promise<DeliveryExpensePreview> {
    return this.batchesService.previewDeliveryExpenses(id, body);
  }

  @Post(":id/expenses/apply")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  applyExpenses(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateDeliveryExpensesRequestSchema))
    body: UpdateDeliveryExpensesRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ApplyDeliveryExpensesResponse> {
    return this.batchesService.applyDeliveryExpenses(id, body, actor.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "WAREHOUSE_WORKER")
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.batchesService.deleteDelivery(id);
  }
}
