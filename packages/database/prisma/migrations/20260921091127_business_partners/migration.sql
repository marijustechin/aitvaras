-- CreateEnum
CREATE TYPE "PartnerRoleKey" AS ENUM ('SUPPLIER', 'BUYER');

-- CreateTable
CREATE TABLE "business_partners" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "company_code" VARCHAR(64),
    "vat_code" VARCHAR(64),
    "address" VARCHAR(500),
    "country" VARCHAR(100),
    "contact_person" VARCHAR(200),
    "phone" VARCHAR(64),
    "email" VARCHAR(254),
    "notes" VARCHAR(2000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_roles" (
    "partner_id" UUID NOT NULL,
    "role" "PartnerRoleKey" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_roles_pkey" PRIMARY KEY ("partner_id","role")
);

-- CreateIndex
CREATE INDEX "business_partners_name_idx" ON "business_partners"("name");

-- AddForeignKey
ALTER TABLE "partner_roles" ADD CONSTRAINT "partner_roles_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "business_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
