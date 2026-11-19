-- Receipt expense application ledger. Each apply records the previous/new share
-- per batch, who applied it and when. The batch allocation columns remain the
-- current applied shares used by stock valuation.

CREATE TABLE "delivery_expense_applications" (
    "id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "transport_amount" DECIMAL(14,2) NOT NULL,
    "customs_amount" DECIMAL(14,2) NOT NULL,
    "allocation_method" "DeliveryExpenseAllocationMethod" NOT NULL,
    "applied_by_id" UUID NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_expense_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "delivery_expense_applications_delivery_id_applied_at_idx"
  ON "delivery_expense_applications"("delivery_id", "applied_at");

CREATE TABLE "delivery_expense_application_entries" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "previous_transport_amount" DECIMAL(14,2) NOT NULL,
    "new_transport_amount" DECIMAL(14,2) NOT NULL,
    "previous_customs_amount" DECIMAL(14,2) NOT NULL,
    "new_customs_amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "delivery_expense_application_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_expense_application_entries_application_id_batch_id_key"
  ON "delivery_expense_application_entries"("application_id", "batch_id");

CREATE INDEX "delivery_expense_application_entries_batch_id_idx"
  ON "delivery_expense_application_entries"("batch_id");

ALTER TABLE "delivery_expense_applications"
  ADD CONSTRAINT "delivery_expense_applications_delivery_id_fkey"
  FOREIGN KEY ("delivery_id") REFERENCES "incoming_deliveries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_expense_applications"
  ADD CONSTRAINT "delivery_expense_applications_applied_by_id_fkey"
  FOREIGN KEY ("applied_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delivery_expense_application_entries"
  ADD CONSTRAINT "delivery_expense_application_entries_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "delivery_expense_applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_expense_application_entries"
  ADD CONSTRAINT "delivery_expense_application_entries_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "batches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;