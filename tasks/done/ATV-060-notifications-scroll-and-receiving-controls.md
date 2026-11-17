# ATV-060 — Global notifications, scroll-to-top, Nustatymai and company details

- **Status:** done (uncommitted; for human review)
- **Scope:** app-wide toast convention, scroll arrow simplification, `Sistema` →
  `Nustatymai`, shared operator company settings; plus the earlier ATV-060 slice
  (voided labels, toasts, scroll-to-top, tare labels)
- **Depends on:** shell, receiving/batch screens (ATV-057…059)

## Implemented

### 1. One notification convention

- `ToastProvider`/`useToast` is mounted once in the root layout and is now the
  **only** path for user-action feedback: client validation, required/invalid/
  conflicting fields, save/create/update/void/confirm results, confirmations and
  API/network failures. Colours remain yellow informational, green success and
  red error/warning; errors stay longer; tone+message pairs are de-duplicated;
  toasts are dismissible and expose accessible tone labels.
- Every audited action path was migrated. Client validation that blocks the
  request now shows a red toast instead of inline text; the first invalid field
  is focused (`focusField`), keeps/gets an error border and `aria-invalid`, and
  entered values survive. Multi-field failures produce one concise
  `Patikrinkite laukus: …` summary (`invalidFieldsSummary`).
- Migrated action feedback in: login; profile names/password; partners create/
  edit (field errors now toast-summarised; the form no longer renders inline
  field messages); resources create/edit; resource categories; packaging types;
  warehouses list/detail and locations; users create/edit/active/password reset;
  receiving delivery creation; delivery/package/piece add-correct-void forms;
  batch metadata editor; batch confirmation/reconciliation; discrepancy
  settlement; company details.
- Decision dialogs and permanent explanatory states remain inline (not-found,
  failed page load, open-discrepancy warning, “no active categories”, etc.).
- Convention documented in `docs/frontend-architecture.md` and `AGENTS.md`;
  helper in `apps/web/src/shared/lib/form-feedback.ts`.

### 2. Scroll-to-top

- Shared `ScrollToTop` mounted once in `AppShell`.
- White circular button, black border, black upward arrow only, no visible text;
  `Į viršų` remains `aria-label` and `title`; 44×44px target, visible focus ring.
- Visibility/scroll behaviour is unchanged: after 320px in the actual scroll
  container, recalculation on scroll/resize/route/content height, reduced-motion
  instant scroll.

### 3. `Sistema` → `Nustatymai`

- Sidebar destination, breadcrumb and page context now say **Nustatymai**.
- Route-based horizontal children: **Įmonė** (`/settings/company`) and
  **Naudotojai** (`/admin/users`); direct links, refresh, back/forward and
  ADMIN-only permissions are preserved. The existing users page was reused.
- Navigation tests updated.

### 4. Company details (`Įmonė`)

- No prior company settings model existed. Added a shared singleton
  `CompanySettings` (`company_settings` table, fixed id) with name, registration
  number, optional VAT number, country, address, email and telephone.
- Contracts: `CompanySettingsSchema`, `UpdateCompanySettingsRequestSchema` and
  tests. Registration name/number/country are required; server re-validates.
- API: `GET /settings/company` (authenticated) returns the saved record or an
  empty record (`updatedAt: null`) without writing defaults;
  `PUT /settings/company` is ADMIN-only. No defaults overwrite existing data.
- Web: `/settings/company` inside `AppShell roles={["ADMIN"]}`; reuses the shared
  `CountrySelect`, validation and toaster; persists across refresh. The shape is
  extensible for future settings sections. No PVM tariff or VAT calculation
  changes.
- Docs: `docs/company-settings.md`, `docs/scope.md`.

### 5. Earlier ATV-060 slice retained

- Voided label `Etiketė` actions are genuinely disabled and handlers reject
  non-active units.
- Tare selectors use `Pavadinimas (svoris kg)` (`packagingTypeOptionLabel`) with
  Lithuanian decimal formatting; IDs/calculations unchanged.

## Verification

`npm run verify` — passed: lint, Prisma validate, typecheck, tests and builds.
Latest counts: contracts **104**, web **301**, API **244**.

Live checks (Playwright, local dev):

```text
Company save toast: SĖKMĖ — Įmonės duomenys išsaugoti.
Persisted after reload: UAB Aitvaras Sandėliavimas | 305123456 | LT100012345678
  | Lietuva | Vilniaus g. 1, Vilnius | info@aitvaras.lt | +370 600 00000
Package without gross weight: KLAIDA — Įveskite bruto svorį, didesnį už nulį.
  inline validation paragraphs: 0; focus: #bag-gross; entered values kept
Scroll button: title/aria-label "Į viršų", visible text "" ; scrollY 600 → 0
Nustatymai tabs: Įmonė, Naudotojai; users page still works
```

Migration `20261117130000_company_settings` applied to the dev and test
databases.

Screenshots in `docs/screenshots/atv-060/`:
`package-validation-toast.png`, `scroll-to-top-arrow.png`,
`scroll-to-top-arrow-mobile.png`, `company-settings-persisted.png`,
`nustatymai-users.png`, `notifications-all-colors.png`,
`voided-label-disabled.png`, `tare-dropdown.png`.

## Files changed (main)

- Web: `shared/ui/toast.tsx`, `scroll-to-top.tsx`, `country-select.tsx`,
  `shared/lib/form-feedback.ts`; action pages under `features/*`;
  navigation/app-shell; new `features/manage-company-settings/**` and
  `app/settings/company/page.tsx`.
- Contracts: `company-settings.ts` + test, `index.ts`.
- Database: `schema.prisma`, migration `20261117130000_company_settings`.
- API: new `modules/company-settings/**`, `app.module.ts`.
- Docs: `frontend-architecture.md`, `company-settings.md`, `scope.md`,
  `AGENTS.md`, `TODO.md`.

## Unresolved / notes

- Which optional contact fields (address/email/phone) must become required is not
  confirmed; only the VAT number is explicitly optional in the requirement.
- A few inline `role="alert"` states remain intentionally: page-load and
  not-found failures, permanent warnings, and the new company load/retry state.
  They are not action feedback.
- Native OS print dialogs cannot be opened in the test environment; print
  verification remains label/preview inspection.

## Recommended next task

Human review of the notification migration surface and company settings shape
before adding further settings sections.
