-- CreateEnum
CREATE TYPE "ResourceCategoryKey" AS ENUM ('RAW_MATERIAL', 'SEMI_FINISHED', 'FINISHED_PRODUCT');

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" "ResourceCategoryKey" NOT NULL,
    "notes" VARCHAR(2000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_forms" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packing_forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resources_name_idx" ON "resources"("name");

-- CreateIndex
CREATE INDEX "resources_category_idx" ON "resources"("category");

-- CreateIndex
CREATE UNIQUE INDEX "packing_forms_name_key" ON "packing_forms"("name");
