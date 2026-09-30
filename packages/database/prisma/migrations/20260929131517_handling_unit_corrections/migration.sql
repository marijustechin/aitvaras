-- CreateEnum
CREATE TYPE "BagStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateEnum
CREATE TYPE "BagCorrectionKind" AS ENUM ('QUANTITY', 'LOCATION', 'VOID');

-- AlterTable
ALTER TABLE "bags" ADD COLUMN     "status" "BagStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "void_reason" VARCHAR(500),
ADD COLUMN     "voided_at" TIMESTAMP(3),
ADD COLUMN     "voided_by_id" UUID;

-- CreateTable
CREATE TABLE "bag_corrections" (
    "id" UUID NOT NULL,
    "bag_id" UUID NOT NULL,
    "kind" "BagCorrectionKind" NOT NULL,
    "previous_value" VARCHAR(255),
    "new_value" VARCHAR(255),
    "reason" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bag_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bag_corrections_bag_id_idx" ON "bag_corrections"("bag_id");

-- CreateIndex
CREATE INDEX "bags_status_idx" ON "bags"("status");

-- AddForeignKey
ALTER TABLE "bags" ADD CONSTRAINT "bags_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bag_corrections" ADD CONSTRAINT "bag_corrections_bag_id_fkey" FOREIGN KEY ("bag_id") REFERENCES "bags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bag_corrections" ADD CONSTRAINT "bag_corrections_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
