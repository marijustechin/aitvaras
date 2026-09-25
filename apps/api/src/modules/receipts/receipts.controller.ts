import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import {
  CreateGoodsReceiptRequestSchema,
  type CreateGoodsReceiptRequest,
  type GoodsReceipt,
} from "@aitvaras/contracts";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { ReceiptsService } from "./receipts.service";

/**
 * Goods receipts (Pajamavimas).
 *
 * Authenticated users may list, read and create — this is expected to become an
 * operational warehouse workflow (no ADMIN restriction, no new permission
 * framework). No PATCH/DELETE yet: lifecycle is not designed.
 */
@Controller("receipts")
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  list(): Promise<GoodsReceipt[]> {
    return this.receiptsService.list();
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<GoodsReceipt> {
    return this.receiptsService.get(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateGoodsReceiptRequestSchema))
    body: CreateGoodsReceiptRequest,
  ): Promise<GoodsReceipt> {
    return this.receiptsService.create(body);
  }
}
