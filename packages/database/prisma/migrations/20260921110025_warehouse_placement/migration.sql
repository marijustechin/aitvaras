/*
  Warnings:

  - Added the required column `warehouse_id` to the `goods_receipt_lines` table without a default value. This is not possible if the table is not empty.
  - Added the required column `warehouse_location_id` to the `goods_receipt_lines` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "goods_receipt_lines" ADD COLUMN     "warehouse_id" UUID NOT NULL,
ADD COLUMN     "warehouse_location_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_locations" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warehouses_name_idx" ON "warehouses"("name");

-- CreateIndex
CREATE INDEX "warehouse_locations_warehouse_id_idx" ON "warehouse_locations"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_locations_warehouse_id_name_key" ON "warehouse_locations"("warehouse_id", "name");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_warehouse_id_idx" ON "goods_receipt_lines"("warehouse_id");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_warehouse_location_id_idx" ON "goods_receipt_lines"("warehouse_location_id");

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_warehouse_location_id_fkey" FOREIGN KEY ("warehouse_location_id") REFERENCES "warehouse_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
