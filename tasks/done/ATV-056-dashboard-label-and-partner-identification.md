# ATV-056 — Dashboard label and partner identification

- **Status:** done (uncommitted; for human review)
- **Scope:** sidebar label, partner company identification, country selector, uniqueness constraint, existing-data migration
- **Depends on:** ATV-055 shell/navigation; existing partner module (ATV-015) and routes/permissions

## Objective

Rename the dashboard destination to `Suvestinė` without changing `/`, and make
company partner identification complete and reliable: required name, country and
registration number, unique per country, string-preserving, with a searchable
ISO country selector and clear Lithuanian field errors.

## Implemented

1. **Dashboard label**
   - Sidebar destination and breadcrumb: `Pradžia` → `Suvestinė`; route stays `/`.
   - Home page heading is now `Suvestinė` with the greeting as a subtitle.
   - Navigation tests and current docs updated.

2. **Required company identification**
   - `CreatePartnerRequestSchema` requires `name`, `country`, `companyCode`.
   - `UpdatePartnerRequestSchema` validates supplied fields; the service validates
     the **resulting** record so an update can never leave/clear required
     identification. Editing without changing identification succeeds.
   - `companyCode` is a trimmed string (≤ 64), never numeric; leading zeros are
     preserved. No Lithuania-only length/checksum/numeric format.
   - There is **no individual/natural-person distinction** in the current model
     (checked schema, contracts, UI, legacy fields). All partners are therefore
     treated as companies; this is documented rather than inventing a type field.

3. **Uniqueness**
   - `(country, companyCode)` is unique, via Prisma `@@unique` and migration index
     `business_partners_country_company_code_key`.
   - The same registration number in different countries is allowed.
   - API pre-check returns `409 PARTNER_DUPLICATE_IDENTIFICATION` with
     `errors: [{ path: "companyCode", message: "Šioje šalyje jau yra partneris su
     tokiu įmonės kodu." }]`; Prisma `P2002` is mapped to the same conflict.
   - The update duplicate check excludes the edited record itself.

4. **Country selector**
   - Added `i18n-iso-countries@7.14.0` (Lithuanian locale, standard ISO 3166-1
     dataset) and shared `countries.ts` in `@aitvaras/contracts`.
   - `COUNTRY_OPTIONS` exposes all 250 dataset entries with Lithuanian names;
     storage/API is uppercase alpha-2 (`LT`, `GB`).
   - Shared `CountrySelect` (used by create and edit): searchable by Lithuanian
     name (diacritics ignored) and code, keyboard-operable listbox, required
     selection, no free-text values, displays the selected Lithuanian name.
   - Partner list/details display the Lithuanian country name, not the raw code.

5. **Field-level UI errors**
   - `PartnerForm` accepts per-field errors and clears them as the user edits.
   - Client validation shows `Įveskite partnerio pavadinimą.`,
     `Pasirinkite bent vieną vaidmenį.`, `Įveskite įmonės kodą.`,
     `Pasirinkite šalį.`; API details are mapped to the same fields.
   - `noValidate` ensures the Lithuanian field errors are shown instead of the
     browser's native bubbles.

## Existing-data inspection (before constraints)

Development database on 2026-11-17:

- **2 partners**, both `Ediltex Ltd.`
- Both countries were `Jungtinė Karalystė` — recognizable → converted to `GB`
- **Both registration numbers missing** (NULL); left NULL, no numbers invented
- **No non-null `(country, companyCode)` duplicates**
- **No ambiguous country values** beyond the recognizable UK name
- **No conflicting records**; identical names/countries but no numbers, so no
  automatic merge
- Both records have linked operations (8 receipts, 10 deliveries, 5
  discrepancies total) — preserved

Migration `20261117120000_partner_identification` converts the UK value,
uppercases code-shaped values, and creates the unique index. Legacy rows remain
editable only after their registration number is supplied; they are not merged or
deleted.

## Files changed

- Contracts: `countries.ts` (new), `countries.test.ts`,
  `partners.ts`, `partners.test.ts`, `index.ts`, `package.json`.
- Database: `schema.prisma`; migration
  `20261117120000_partner_identification/migration.sql`.
- API: `modules/partners/partners.service.ts`;
  `test/partners.e2e.test.ts` (required fields, duplicates, countries, leading
  zeros, edit-in-place, DB constraint).
- Web: `shared/ui/country-select.tsx`, `shared/ui/index.ts`,
  partner form/lib/API-error mapping and tests, partner list/details country
  labels, dashboard/home label, navigation label/test.
- Docs: `partners.md`, `architecture.md`, `frontend-architecture.md`,
  `batches.md`, `warehouses.md`, `README.md`, `AGENTS.md`, `TODO.md`.

## Verification

- **`npm run verify`** — passed: lint, Prisma validate, typecheck all packages,
  tests (contracts **99**, web **277**, API **231**), and all builds.
- Browser (Playwright, local dev, ADMIN `localdev`):
  - empty submit shows all four Lithuanian field errors;
  - country search by `jungtine` and by `gb` finds `Jungtinė Karalystė`;
  - created partner persists `GB` + `0009922`; edit form reopens with the
    Lithuanian country name and leading-zero code; saving unchanged succeeds;
  - duplicate country+code shows the Lithuanian field error on `Įmonės kodas`;
  - same code `0009922` with `LV` is accepted;
  - test records were removed afterwards, leaving the two original partners.
- Screenshots: `docs/screenshots/atv-056/` —
  `partner-form-required.png`, `partner-form-country-search.png`,
  `partner-form-duplicate.png`, `partner-form-edit.png`.

## Unresolved / notes

- The two existing partners still have `NULL` registration numbers by design.
  They must be filled in on the next edit; no values were invented.
- `i18n-iso-countries` includes the dataset's practical `XK` (Kosovo) entry in
  addition to official ISO codes. No separate country-management screen exists.
- No API/permissions/route changes beyond partner validation; no commit/push.
