-- Packaging / tare master data (Tara) and gross/net weights on handling units.
--
-- A physical package now references one PackagingType; the worker enters the
-- gross weight and the server derives netWeight = grossWeight - tareWeightKg.
--
-- Historical provenance: existing handling units carry a measured weight but no
-- known packaging/tare, so they are attached to a dedicated, INACTIVE
-- "Nežinoma tara" row whose tare is 0.000 kg. This keeps netWeight = the stored
-- weight without inventing a tare, and (being inactive) the row cannot be chosen
-- for new receiving. Documented in docs/batches.md.

-- CreateTable
CREATE TABLE "packaging_types" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "tare_weight_kg" DECIMAL(14,3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packaging_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packaging_types_name_key" ON "packaging_types"("name");

-- Explicit unknown-provenance fallback for historical handling units.
INSERT INTO "packaging_types" ("id", "name", "tare_weight_kg", "active", "created_at", "updated_at")
VALUES ('a0000000-0000-4000-8000-000000000001', 'Nežinoma tara', 0.000, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- AlterTable bags: add packaging + gross weight + the tare snapshot, rename the
-- measured weight to net weight, and backfill historical rows against the
-- fallback packaging type. Historical rows have no known tare, so the snapshot is
-- 0.000 and gross = net (the existing net is preserved unchanged).
ALTER TABLE "bags" ADD COLUMN "packaging_type_id" UUID;
ALTER TABLE "bags" ADD COLUMN "gross_weight" DECIMAL(14,3);
ALTER TABLE "bags" ADD COLUMN "tare_weight_kg" DECIMAL(14,3);
ALTER TABLE "bags" RENAME COLUMN "weight" TO "net_weight";
UPDATE "bags"
SET "gross_weight" = "net_weight",
    "tare_weight_kg" = 0.000,
    "packaging_type_id" = 'a0000000-0000-4000-8000-000000000001';
ALTER TABLE "bags" ALTER COLUMN "packaging_type_id" SET NOT NULL;
ALTER TABLE "bags" ALTER COLUMN "gross_weight" SET NOT NULL;
ALTER TABLE "bags" ALTER COLUMN "tare_weight_kg" SET NOT NULL;

-- CreateIndex
CREATE INDEX "bags_packaging_type_id_idx" ON "bags"("packaging_type_id");

-- AlterEnum
ALTER TYPE "BagCorrectionKind" RENAME VALUE 'WEIGHT' TO 'GROSS_WEIGHT';
ALTER TYPE "BagCorrectionKind" ADD VALUE 'PACKAGING';

-- AddForeignKey
ALTER TABLE "bags" ADD CONSTRAINT "bags_packaging_type_id_fkey" FOREIGN KEY ("packaging_type_id") REFERENCES "packaging_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
