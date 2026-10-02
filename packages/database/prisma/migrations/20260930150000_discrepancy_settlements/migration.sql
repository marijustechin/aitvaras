-- Append-only settlement ledger for receiving discrepancies.
--
-- Each entry records how much of the original discrepancy magnitude
-- (|measuredWeight - documentWeight|) is resolved. `covered_weight_kg` is always
-- positive (kg); WEIGHT may link a later confirmed batch (it already owns the
-- physical stock), MONEY records a money/credit amount with no kg conversion.
-- `money_amount`/`currency` are nullable so WEIGHT rows stay weight-only.

-- CreateEnum
CREATE TYPE "DiscrepancySettlementType" AS ENUM ('WEIGHT', 'MONEY');

-- CreateTable
CREATE TABLE "discrepancy_settlements" (
    "id" UUID NOT NULL,
    "discrepancy_id" UUID NOT NULL,
    "type" "DiscrepancySettlementType" NOT NULL,
    "covered_weight_kg" DECIMAL(14,3) NOT NULL,
    "money_amount" DECIMAL(14,2),
    "currency" VARCHAR(8),
    "source_batch_id" UUID,
    "reference" VARCHAR(255),
    "note" VARCHAR(2000),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discrepancy_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discrepancy_settlements_discrepancy_id_idx" ON "discrepancy_settlements"("discrepancy_id");

-- CreateIndex
CREATE INDEX "discrepancy_settlements_source_batch_id_idx" ON "discrepancy_settlements"("source_batch_id");

-- AddForeignKey
ALTER TABLE "discrepancy_settlements" ADD CONSTRAINT "discrepancy_settlements_discrepancy_id_fkey" FOREIGN KEY ("discrepancy_id") REFERENCES "receiving_discrepancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrepancy_settlements" ADD CONSTRAINT "discrepancy_settlements_source_batch_id_fkey" FOREIGN KEY ("source_batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrepancy_settlements" ADD CONSTRAINT "discrepancy_settlements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
