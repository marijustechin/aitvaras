-- Compact, delivery-local batch codes (`P01`..`P99`).
--
-- The IncomingDelivery code is the primary human-facing identifier, so a batch
-- code only needs to be unique within its delivery. Replace the global unique
-- index on `batches.code` with a composite unique index on `(delivery_id, code)`
-- and reassign existing codes deterministically (per delivery, by creation order).
-- Limitation: a delivery with more than 99 historical batches would produce
-- `P100+` here; this cannot occur with the current data (each migrated delivery
-- is one batch) and new batches are capped at `P99`.

-- DropIndex
DROP INDEX "batches_code_key";

-- Reassign existing codes: `P01`, `P02`, ... within each delivery (deterministic).
WITH numbered AS (
    SELECT "id",
           row_number() OVER (
               PARTITION BY "delivery_id"
               ORDER BY "created_at", "id"
           ) AS rn
    FROM "batches"
)
UPDATE "batches" b
SET "code" = 'P' || lpad(n.rn::text, 2, '0')
FROM numbered n
WHERE b."id" = n."id";

-- CreateIndex
CREATE UNIQUE INDEX "batches_delivery_id_code_key" ON "batches"("delivery_id", "code");
