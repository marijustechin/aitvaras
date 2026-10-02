-- Introduce IncomingDelivery (Gavimas): one physical arrival of ONE supplier on
-- ONE arrival date, containing one or more resource batches. Warehouse belongs to
-- the BATCH (a single delivery may contain the same resource going to different
-- warehouses). Physical receiving is weight-based: handling units store an actual
-- weight only (no KG/PCS unit), and a batch may carry an optional documentary
-- piece count. No transport/vehicle is modelled.
--
-- Data migration (existing batches -> deliveries):
--   * there is no provable historical grouping of existing batches into shared
--     arrivals, so each existing batch becomes its own delivery;
--   * the delivery id reuses the batch id (deterministic and safe: UUIDs are
--     unique per table);
--   * the delivery code `GYYMM-NN` is a per-calendar-month sequence over the
--     existing batches, ordered by arrival date then creation time;
--   * the batch keeps its warehouse (warehouse ownership is NOT moved to the
--     delivery); the batch's supplier + arrival date move to the delivery.
-- Limitation: historical batches that were physically one delivery stay separate
-- deliveries; this is documented in docs/batches.md.

-- CreateTable
CREATE TABLE "incoming_deliveries" (
    "id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "arrival_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incoming_deliveries_pkey" PRIMARY KEY ("id")
);

-- Backfill one delivery per existing batch (deterministic id = batch id).
INSERT INTO "incoming_deliveries" ("id", "code", "supplier_id", "arrival_date", "created_by_id", "created_at", "updated_at")
SELECT
    b."id",
    'G' || to_char(b."arrival_date", 'YY') || to_char(b."arrival_date", 'MM') || '-' || lpad(x.rn::text, 2, '0'),
    b."supplier_id",
    b."arrival_date",
    b."created_by_id",
    b."created_at",
    b."updated_at"
FROM "batches" b
JOIN (
    SELECT "id",
           row_number() OVER (
               PARTITION BY date_trunc('month', "arrival_date")
               ORDER BY "created_at", "id"
           ) AS rn
    FROM "batches"
) x ON x."id" = b."id";

-- AlterTable batches: link the delivery and add the optional documentary pieces.
ALTER TABLE "batches" ADD COLUMN "delivery_id" UUID;
UPDATE "batches" SET "delivery_id" = "id";
ALTER TABLE "batches" ALTER COLUMN "delivery_id" SET NOT NULL;
ALTER TABLE "batches" ADD COLUMN "document_pieces" INTEGER;

-- The batch keeps its warehouse; only the supplier + arrival date move to the
-- delivery and are dropped here.
ALTER TABLE "batches" DROP CONSTRAINT "batches_supplier_id_fkey";
DROP INDEX "batches_supplier_id_idx";
ALTER TABLE "batches" DROP COLUMN "supplier_id";
ALTER TABLE "batches" DROP COLUMN "arrival_date";

-- Physical receiving is weight-based: rename `quantity` -> `weight` (preserves
-- every existing measured value) and drop the KG/PCS unit concept entirely.
ALTER TABLE "bags" RENAME COLUMN "quantity" TO "weight";
ALTER TABLE "bags" DROP COLUMN "unit";
ALTER TYPE "BagCorrectionKind" RENAME VALUE 'QUANTITY' TO 'WEIGHT';
DROP TYPE "HandlingUnitKey";

-- CreateIndex
CREATE UNIQUE INDEX "incoming_deliveries_code_key" ON "incoming_deliveries"("code");
CREATE INDEX "incoming_deliveries_supplier_id_idx" ON "incoming_deliveries"("supplier_id");
CREATE INDEX "incoming_deliveries_created_at_idx" ON "incoming_deliveries"("created_at");
CREATE UNIQUE INDEX "batches_delivery_id_resource_id_warehouse_id_key" ON "batches"("delivery_id", "resource_id", "warehouse_id");

-- AddForeignKey
ALTER TABLE "incoming_deliveries" ADD CONSTRAINT "incoming_deliveries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "business_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incoming_deliveries" ADD CONSTRAINT "incoming_deliveries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "batches" ADD CONSTRAINT "batches_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "incoming_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
