-- PIECE-batch product-level documentary reconciliation.
--
-- Extends the (committed) receiving discrepancy to support two kinds: `WEIGHT`
-- (unchanged: measured/document/difference weight, one per batch) and `PIECE`
-- (actual/document/difference pieces per resource, zero-to-many per batch). The
-- weight columns become nullable for PIECE rows and the batch-level uniqueness is
-- replaced by a plain index; idempotency is enforced by the transactional
-- confirmation (batch status flip) plus this table's uniqueness where relevant.
--
-- Adds `piece_reconciliation_lines` (one documentary line per batch + resource;
-- `actual_pieces` is a server-side snapshot from the active PIECE groups).

-- CreateEnum
CREATE TYPE "ReceivingDiscrepancyKind" AS ENUM ('WEIGHT', 'PIECE');

-- AlterTable
ALTER TABLE "receiving_discrepancies" ADD COLUMN "kind" "ReceivingDiscrepancyKind" NOT NULL DEFAULT 'WEIGHT';
ALTER TABLE "receiving_discrepancies" ADD COLUMN "resource_id" UUID;
ALTER TABLE "receiving_discrepancies" ADD COLUMN "actual_pieces" INTEGER;
ALTER TABLE "receiving_discrepancies" ADD COLUMN "document_pieces" INTEGER;
ALTER TABLE "receiving_discrepancies" ADD COLUMN "difference_pieces" INTEGER;
ALTER TABLE "receiving_discrepancies" ALTER COLUMN "measured_weight" DROP NOT NULL;
ALTER TABLE "receiving_discrepancies" ALTER COLUMN "document_weight" DROP NOT NULL;
ALTER TABLE "receiving_discrepancies" ALTER COLUMN "difference_weight" DROP NOT NULL;

-- DropIndex
DROP INDEX "receiving_discrepancies_batch_id_key";

-- CreateIndex
CREATE INDEX "receiving_discrepancies_batch_id_idx" ON "receiving_discrepancies"("batch_id");

-- CreateIndex
CREATE INDEX "receiving_discrepancies_resource_id_idx" ON "receiving_discrepancies"("resource_id");

-- AddForeignKey
ALTER TABLE "receiving_discrepancies" ADD CONSTRAINT "receiving_discrepancies_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "piece_reconciliation_lines" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "actual_pieces" INTEGER NOT NULL,
    "document_pieces" INTEGER NOT NULL,
    "difference_pieces" INTEGER NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piece_reconciliation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "piece_reconciliation_lines_batch_id_resource_id_key" ON "piece_reconciliation_lines"("batch_id", "resource_id");

-- CreateIndex
CREATE INDEX "piece_reconciliation_lines_batch_id_idx" ON "piece_reconciliation_lines"("batch_id");

-- CreateIndex
CREATE INDEX "piece_reconciliation_lines_resource_id_idx" ON "piece_reconciliation_lines"("resource_id");

-- AddForeignKey
ALTER TABLE "piece_reconciliation_lines" ADD CONSTRAINT "piece_reconciliation_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piece_reconciliation_lines" ADD CONSTRAINT "piece_reconciliation_lines_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piece_reconciliation_lines" ADD CONSTRAINT "piece_reconciliation_lines_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
