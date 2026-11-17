-- Partner identification: canonical country codes + unique registration number.
--
-- Pre-migration inspection of this database (2026-11-17):
--   * 2 business partners total, both named "Ediltex Ltd."
--   * both country values were "Jungtinė Karalystė" (recognizable → GB)
--   * both registration numbers were NULL (not invented here)
--   * no non-null (country, company_code) duplicates existed
--   * both partners have linked receipts/deliveries/discrepancies
--
-- Existing rows are preserved. Missing registration numbers stay NULL: the API
-- requires them for new/edited company partners, but the database does not
-- invent values for historical records. The unique index tolerates NULLs
-- (PostgreSQL treats NULLs as distinct), so the two legacy rows do not conflict.

-- Convert the one observable recognizable country value (and its common
-- variants) to the ISO 3166-1 alpha-2 code.
UPDATE "business_partners"
SET "country" = 'GB'
WHERE lower(btrim("country")) IN (
  'jungtinė karalystė',
  'jungtine karalyste',
  'united kingdom',
  'great britain',
  'uk',
  'gb'
);

-- Normalise any already-code-shaped values to uppercase (e.g. 'lt' → 'LT').
UPDATE "business_partners"
SET "country" = upper(btrim("country"))
WHERE btrim("country") ~ '^[A-Za-z]{2}$';

-- Same registration number in the same country is forbidden; the same number
-- in a different country remains allowed. NULL legacy values do not conflict.
CREATE UNIQUE INDEX "business_partners_country_company_code_key"
  ON "business_partners"("country", "company_code");
