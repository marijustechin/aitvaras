import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import {
  CreateIncomingDeliveryRequestSchema,
  ResolveBatchRequestSchema,
  type BatchDetail,
  type CreateIncomingDeliveryRequest,
  type IncomingDelivery,
  type IncomingDeliveryDetail,
  type ResolveBatchRequest,
} from "@aitvaras/contracts";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { BatchesService } from "./batches.service";

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
  get(@Param("id", ParseUUIDPipe) id: string): Promise<IncomingDeliveryDetail> {
    return this.batchesService.getDelivery(id);
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
  resolveBatch(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ResolveBatchRequestSchema))
    body: ResolveBatchRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<BatchDetail> {
    return this.batchesService.resolveBatch(id, body, actor.id);
  }
}
