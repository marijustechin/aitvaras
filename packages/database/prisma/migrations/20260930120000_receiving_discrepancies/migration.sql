-- Introduce the ReceivingDiscrepancy register and remove the blocking
-- DISCREPANCY batch status. A documentary/physical mismatch no longer keeps a
-- batch unconfirmed: the batch becomes CONFIRMED and the mismatch is recorded as
-- a separate, long-lived discrepancy.
--
-- Historical transition: any existing `DISCREPANCY` batch is turned into an OPEN
-- `ReceivingDiscrepancy` (measured = SUM of its active net weights, difference =
-- measured - document) and the batch is set to CONFIRMED. (In the current
-- uncommitted slice there are no such rows, but the migration is data-safe.)

-- CreateEnum
CREATE TYPE "ReceivingDiscrepancyStatus" AS ENUM ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED');

-- CreateTable
CREATE TABLE "receiving_discrepancies" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "measured_weight" DECIMAL(14,3) NOT NULL,
    "document_weight" DECIMAL(14,3) NOT NULL,
    "difference_weight" DECIMAL(14,3) NOT NULL,
    "status" "ReceivingDiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "receiving_discrepancies_pkey" PRIMARY KEY ("id")
);

-- Backfill OPEN discrepancies for historical DISCREPANCY batches.
INSERT INTO "receiving_discrepancies" ("id", "batch_id", "supplier_id", "measured_weight", "document_weight", "difference_weight", "status", "created_by_id", "created_at")
SELECT
    gen_random_uuid(),
    b."id",
    d."supplier_id",
    measured."total",
    b."document_weight",
    measured."total" - b."document_weight",
    'OPEN',
    b."created_by_id",
    COALESCE(b."confirmed_at", b."updated_at")
FROM "batches" b
JOIN "incoming_deliveries" d ON d."id" = b."delivery_id"
JOIN LATERAL (
    SELECT COALESCE(SUM(bag."net_weight"), 0) AS "total"
    FROM "bags" bag
    WHERE bag."batch_id" = b."id" AND bag."status" = 'ACTIVE'
) measured ON TRUE
WHERE b."status" = 'DISCREPANCY' AND b."document_weight" IS NOT NULL;

-- Historical DISCREPANCY batches are now confirmed.
UPDATE "batches"
SET "status" = 'CONFIRMED',
    "confirmed_at" = COALESCE("confirmed_at", CURRENT_TIMESTAMP)
WHERE "status" = 'DISCREPANCY';

-- Remove DISCREPANCY from BatchStatus (recreate the enum).
ALTER TYPE "BatchStatus" RENAME TO "BatchStatus_old";
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'CONFIRMED');
ALTER TABLE "batches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "batches" ALTER COLUMN "status" TYPE "BatchStatus" USING ("status"::text::"BatchStatus");
ALTER TABLE "batches" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "BatchStatus_old";

-- CreateIndex
CREATE UNIQUE INDEX "receiving_discrepancies_batch_id_key" ON "receiving_discrepancies"("batch_id");
CREATE INDEX "receiving_discrepancies_status_idx" ON "receiving_discrepancies"("status");
CREATE INDEX "receiving_discrepancies_supplier_id_idx" ON "receiving_discrepancies"("supplier_id");

-- AddForeignKey
ALTER TABLE "receiving_discrepancies" ADD CONSTRAINT "receiving_discrepancies_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receiving_discrepancies" ADD CONSTRAINT "receiving_discrepancies_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "business_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receiving_discrepancies" ADD CONSTRAINT "receiving_discrepancies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
