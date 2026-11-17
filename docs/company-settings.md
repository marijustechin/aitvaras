# Company settings (`Nustatymai` → `Įmonė`)

Shared details of the warehouse operator's own company, shown at
`/settings/company` under **Nustatymai**. This is **not** the partner directory:
suppliers and buyers remain `BusinessPartner` records. It is also **not** a
per-user or browser-local preference — one record is shared by every user of the
installation.

## Confirmed scope

The page stores and edits:

| Field | Rule |
| --- | --- |
| Company name (`name`) | Required |
| Registration number (`companyCode`) | Required; always text so leading zeros survive |
| VAT number (`vatCode`) | Optional |
| Country (`country`) | Required ISO 3166-1 alpha-2 code via the shared selector |
| Address (`address`) | Optional |
| Email (`email`) | Optional |
| Telephone (`phone`) | Optional |

No VAT tariff section, VAT calculation or accounting behaviour is introduced by
this page.

## Persistence and access

- Storage: PostgreSQL table `company_settings`, a **singleton** row with a fixed
  id (`00000000-0000-4000-8000-000000000001`).
- `GET /settings/company` requires authentication and returns the saved record,
  or an empty record (`updatedAt: null`) before the first save. Reading never
  writes defaults, and saving never resets fields to invented values.
- `PUT /settings/company` is **ADMIN-only** (server-enforced; the route is also
  wrapped in `<AppShell roles={["ADMIN"]}>`).
- The structure is deliberately simple so future settings sections (other
  install-wide preferences) can be added as separate records/routes without
  changing this one.

## UI conventions

- Shared country selector, validation and global toaster.
- Client validation blocks the request and shows a red toast; the first invalid
  field is focused, keeps an error border and `aria-invalid`, and entered values
  are preserved.
- A successful save shows a green toast and the form reflects the persisted
  record after refresh.

## Open questions

- Whether any of the optional contact fields must become required is not
  confirmed.
- Multi-company/tenant support is out of scope; the confirmed model is one
  operator company.
