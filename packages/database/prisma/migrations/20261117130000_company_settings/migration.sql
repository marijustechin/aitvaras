-- Operator company details (`Nustatymai` → `Įmonė`).
--
-- A singleton, installation-wide record separate from the partner directory.
-- No row is inserted here: the API returns an empty record until an ADMIN saves
-- the details for the first time, so no business data is invented or
-- overwritten by defaults.

CREATE TABLE "company_settings" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "company_code" VARCHAR(64),
    "vat_code" VARCHAR(64),
    "country" VARCHAR(100),
    "address" VARCHAR(500),
    "email" VARCHAR(254),
    "phone" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);
