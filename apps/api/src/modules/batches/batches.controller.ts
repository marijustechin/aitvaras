import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  BatchStatusSchema,
  CreateBagRequestSchema,
  CreateBatchRequestSchema,
  type Bag,
  type Batch,
  type BatchDetail,
  type BatchStatus,
  type CreateBagRequest,
  type CreateBatchRequest,
} from "@aitvaras/contracts";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { BatchesService } from "./batches.service";

/**
 * Batches (Partijos) and their bags (Maišai).
 *
 * Reading requires authentication only. Starting a batch and adding bags are
 * operational warehouse actions, allowed for ADMIN and warehouse workers; the
 * server remains authoritative. No PATCH/DELETE: the batch lifecycle
 * (confirmation) is not implemented yet.
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
