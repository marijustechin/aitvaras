-- Resource categories become administrator-managed master data.
--
-- This migration is written by hand (not the Prisma-generated destructive form)
-- so that existing resources keep their effective category. It is safe on both a
-- fresh database and an existing one:
--   1. create `resource_categories`;
--   2. seed the three historical categories with deterministic fixed UUIDs;
--   3. add a nullable `resources.category_id`;
--   4. backfill it from the old `ResourceCategoryKey` column;
--   5. enforce NOT NULL + the foreign key;
--   6. drop the obsolete fixed-category column and its enum type.

-- CreateTable
CREATE TABLE "resource_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resource_categories_name_key" ON "resource_categories"("name");

-- Seed the three existing categories deterministically (stable ids, so the
-- backfill below never depends on generated values). ON CONFLICT keeps this
-- idempotent if a category row somehow already exists.
INSERT INTO "resource_categories" ("id", "name", "active", "created_at", "updated_at") VALUES
  ('11111111-1111-4111-8111-111111111111', 'Žaliava',    true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('22222222-2222-4222-8222-222222222222', 'Pusgaminis', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('33333333-3333-4333-8333-333333333333', 'Gaminys',    true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Add the nullable FK column, backfill every existing resource from the old
-- enum value, then enforce NOT NULL. No resource becomes uncategorised.
ALTER TABLE "resources" ADD COLUMN "category_id" UUID;

UPDATE "resources" SET "category_id" = CASE "category"
  WHEN 'RAW_MATERIAL'     THEN '11111111-1111-4111-8111-111111111111'::uuid
  WHEN 'SEMI_FINISHED'    THEN '22222222-2222-4222-8222-222222222222'::uuid
  WHEN 'FINISHED_PRODUCT' THEN '33333333-3333-4333-8333-333333333333'::uuid
  ELSE NULL
END;

ALTER TABLE "resources" ALTER COLUMN "category_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "resources_category_id_idx" ON "resources"("category_id");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "resource_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop the obsolete fixed-category storage (the enum column, its index and the
-- enum type). The FK above already preserves every existing mapping.
ALTER TABLE "resources" DROP COLUMN "category";
DROP TYPE "ResourceCategoryKey";
