-- Piece-based receiving batches.
--
-- A Batch gains a receiving mode (`WEIGHT` | `PIECE`). Existing batches are
-- weight-based, so they migrate to `WEIGHT`. WEIGHT batches keep one resource;
-- PIECE batches own no batch-level resource — their products live on
-- `batch_items` (this concrete resource, this many pieces, at this location).
-- `batches.document_date`/`document_number` carry the PIECE confirmation
-- document metadata (WEIGHT keeps them on the linked GoodsReceipt).

-- CreateEnum
CREATE TYPE "BatchReceivingMode" AS ENUM ('WEIGHT', 'PIECE');

-- CreateEnum
CREATE TYPE "BatchItemStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- AlterTable
ALTER TABLE "batches" ADD COLUMN "receiving_mode" "BatchReceivingMode" NOT NULL DEFAULT 'WEIGHT';
ALTER TABLE "batches" ADD COLUMN "document_date" TIMESTAMP(3);
ALTER TABLE "batches" ADD COLUMN "document_number" VARCHAR(64);
-- `resource_id` is now optional (PIECE batches own no batch-level resource);
-- Prisma's default for an optional relation is ON DELETE SET NULL.
ALTER TABLE "batches" DROP CONSTRAINT "batches_resource_id_fkey";
ALTER TABLE "batches" ALTER COLUMN "resource_id" DROP NOT NULL;
ALTER TABLE "batches" ADD CONSTRAINT "batches_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "batch_items" (
    "id" UUID NOT NULL,
    "barcode" VARCHAR(32) NOT NULL,
    "batch_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "warehouse_location_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "BatchItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "voided_by_id" UUID,
    "voided_at" TIMESTAMP(3),
    "void_reason" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "batch_items_barcode_key" ON "batch_items"("barcode");

-- CreateIndex
CREATE INDEX "batch_items_batch_id_idx" ON "batch_items"("batch_id");

-- CreateIndex
CREATE INDEX "batch_items_resource_id_idx" ON "batch_items"("resource_id");

-- CreateIndex
CREATE INDEX "batch_items_warehouse_location_id_idx" ON "batch_items"("warehouse_location_id");

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_warehouse_location_id_fkey" FOREIGN KEY ("warehouse_location_id") REFERENCES "warehouse_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
