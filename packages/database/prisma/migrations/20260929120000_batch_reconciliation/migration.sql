-- Batch reconciliation with the formal GoodsReceipt. Purely additive.
--
-- GoodsReceipt gains formal business-document metadata (`document_date`,
-- `document_number`), distinct from `created_at` (system record time).
--
-- Batch gains a nullable, UNIQUE link to one GoodsReceiptLine (the formal
-- document anchor) plus the accepted documentary weight/acquisition values
-- entered at reconciliation and the confirmation timestamp. No existing table is
-- altered destructively; the unique index tolerates multiple NULLs (Postgres).

-- AlterTable
ALTER TABLE "goods_receipts" ADD COLUMN "document_date" TIMESTAMP(3);
ALTER TABLE "goods_receipts" ADD COLUMN "document_number" VARCHAR(64);

-- AlterTable
ALTER TABLE "batches" ADD COLUMN "receipt_line_id" UUID;
ALTER TABLE "batches" ADD COLUMN "document_weight" DECIMAL(14,3);
ALTER TABLE "batches" ADD COLUMN "acquisition_amount" DECIMAL(14,2);
ALTER TABLE "batches" ADD COLUMN "confirmed_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "batches_receipt_line_id_key" ON "batches"("receipt_line_id");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_receipt_line_id_fkey" FOREIGN KEY ("receipt_line_id") REFERENCES "goods_receipt_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
