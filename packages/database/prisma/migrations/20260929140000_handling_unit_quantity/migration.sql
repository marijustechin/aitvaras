-- Generalise handling units from a bare weight to a quantity + measurement unit,
-- and require a warehouse location.
--
-- Safe evolution of committed data:
--   * `weight` -> `quantity` (RENAME preserves every existing measured value);
--   * new `unit` column defaults to `KG`, so existing weight rows stay valid;
--   * `warehouse_location_id` becomes NOT NULL with ON DELETE RESTRICT, so a
--     physical unit is always placed in a location (existing rows are unaffected
--     because none had a NULL location when this migration was written).
--
-- Reconciliation remains weight-based and applies to KG batches only.

-- CreateEnum
CREATE TYPE "HandlingUnitKey" AS ENUM ('KG', 'PCS');

-- RenameColumn
ALTER TABLE "bags" RENAME COLUMN "weight" TO "quantity";

-- AddColumn
ALTER TABLE "bags" ADD COLUMN "unit" "HandlingUnitKey" NOT NULL DEFAULT 'KG';

-- Enforce a required, restrict-protected location
ALTER TABLE "bags" DROP CONSTRAINT "bags_warehouse_location_id_fkey";
ALTER TABLE "bags" ALTER COLUMN "warehouse_location_id" SET NOT NULL;
ALTER TABLE "bags" ADD CONSTRAINT "bags_warehouse_location_id_fkey" FOREIGN KEY ("warehouse_location_id") REFERENCES "warehouse_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
