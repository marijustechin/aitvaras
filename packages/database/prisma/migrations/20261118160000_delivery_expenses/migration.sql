-- Receipt-level transport/customs expenses and per-batch confirmation snapshots.
--
-- The expense record is one per incoming delivery. Batch allocation columns stay
-- NULL until that batch is confirmed; confirmation freezes the shares so later
-- expense edits cannot rewrite confirmed stock valuation.

CREATE TYPE "DeliveryExpenseAllocationMethod" AS ENUM ('BY_VALUE', 'EQUAL');

CREATE TABLE "incoming_delivery_expenses" (
    "id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "transport_amount" DECIMAL(14,2) NOT NULL,
    "customs_amount" DECIMAL(14,2) NOT NULL,
    "allocation_method" "DeliveryExpenseAllocationMethod" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incoming_delivery_expenses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "incoming_delivery_expenses_delivery_id_key"
  ON "incoming_delivery_expenses"("delivery_id");

ALTER TABLE "batches"
  ADD COLUMN "allocated_transport_amount" DECIMAL(14,2),
  ADD COLUMN "allocated_customs_amount" DECIMAL(14,2);

ALTER TABLE "incoming_delivery_expenses"
  ADD CONSTRAINT "incoming_delivery_expenses_delivery_id_fkey"
  FOREIGN KEY ("delivery_id") REFERENCES "incoming_deliveries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
