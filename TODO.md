# TODO — Aitvaras Roadmap

High-level navigation. Detailed work lives in `tasks/current/` and
`tasks/done/`. See [docs/scope.md](docs/scope.md): Aitvaras builds **confirmed
requirements only**, step by step. Discovery artifacts are **not** a roadmap.

Status legend: **DONE** · **CURRENT** · **NEXT** · **LATER / DISCOVERY ONLY**

---

## DONE

- **Foundation harness** — pnpm workspace, `apps/{api,web}`,
  `packages/{config,contracts,database}`, task journal, docs, `pnpm verify`.
- **Persistence foundation** — PostgreSQL + Prisma configured.
- **Scope clarification** — legacy discovery explicitly marked as unapproved
  discovery, not a roadmap (`docs/scope.md`, ADR-004).
- **Identity & access foundation (ATV-004 / O-036)** — the only confirmed
  functional scope:
  - users (unique username, Argon2id hash, active flag), explicit roles;
  - `POST /auth/login`, `GET /auth/me`;
  - global JWT auth guard + roles guard with `@Roles`/`@Public`/`@CurrentUser`;
  - admin-only `/users` (list, create, patch roles/active/password);
  - four confirmed roles (ADMIN, WAREHOUSE_WORKER, ACCOUNTING,
    PRODUCTION_MANAGER) seeded as configuration;
  - safe, idempotent admin bootstrap (`pnpm bootstrap:admin`);
  - web login flow + admin users page;
  - unit + DB integration tests; `pnpm verify` passes.
  - Docs: `authentication.md`, `authorization.md`.
- **Foundation aligned with current tech (ATV-005 / O-038)** — Prisma ORM
  `7.10.0` (new `prisma-client` generator + `@prisma/adapter-pg`); API moved to
  `src/modules/*`, `src/infrastructure/*`, `src/common/*`. ADR-008 (amends
  ADR-002).
- **Identity refinement + dev ports (ATV-006 / O-039)** — required
  `firstName`/`lastName` display fields (username remains the login credential);
  `RoleKey` enum with the relational multi-role model retained; local ports
  default to API `3010` / Web `3011` (configurable). ADR-009 (amends ADR-007).
- **Lithuanian UI, dev seed, clean initial migration (ATV-007 / O-040)** — UI is
  Lithuanian only (no i18n framework; monochrome preserved); English role keys
  with centralised Lithuanian labels; guarded `pnpm seed:dev`
  (`localdev`/`localdev`, development+local only) separate from secure
  bootstrap; pre-release migration chain consolidated into one
  `initial_identity_access` migration. ADR-010.
- **Brand assets integrated (ATV-008 / O-041)** — approved logos used via a
  responsive `BrandMark` (symbol narrow / horizontal wide) on login, shell and
  admin; favicon set to the symbol. UI-only (`docs/branding.md`).
- **Favicon + footer polish (ATV-009 / O-042)** — light-background favicon;
  minimal footer `© Alfasis UAB · Aitvaras v{version}` on all screens; version
  single-sourced from root `package.json`. UI-only.
- **Auth hardening (ATV-010 / O-044)** — httpOnly cookie auth (no localStorage),
  logout, credentialed CORS, CSRF decision, login rate limiting/lockout,
  accessible password toggle. ADR-011.
- **Login UX / dev reliability (ATV-011 / O-045)** — non-destructive dev seed
  test (localdev survives `pnpm verify`), corrected eye-icon semantics,
  development-only login hint, clearer login error mapping.
- **Test DB isolation (ATV-012 / O-046)** — integration tests use a dedicated
  `aitvaras_test` DB via `TEST_DATABASE_URL` with a safety guard; the
  development database is never touched by tests.
- **Application shell + profile (ATV-013 / O-048)** — sticky top bar, brand,
  role-aware navigation, user menu, and `/profile` self-service (names +
  password change) via `PATCH /auth/me`. Navigation contains only confirmed,
  implemented functionality.
- **Lithuanian UI terminology (ATV-014 / O-049)** — user-facing Role/Roles →
  `Vaidmuo`/`Vaidmenys`, Status/Statuses → `Būsena`/`Būsenos`; technical
  identifiers stay English. Rule recorded in `AGENTS.md`; guarded by
  `terminology.test.ts`.
- **Business partners (ATV-015 / O-051)** — first confirmed business-domain
  module. One unified `BusinessPartner` (never separate supplier/buyer),
  multi-valued business roles `SUPPLIER`/`BUYER` (Tiekėjas/Pirkėjas), required
  name + ≥1 role, active/inactive lifecycle (deactivate, not delete),
  free-text country, no speculative uniqueness. `GET/POST/PATCH /partners`;
  viewing authenticated, mutation `ADMIN`. UI `/partners`, `/partners/new`,
  `/partners/[id]`; navigation `Partneriai`. Docs: `partners.md`,
  `domain-glossary.md`.
- **Resources, categories & packing forms (ATV-016 / O-052)** — second confirmed
  business-domain scope. `Resource` (name required, exactly one category, notes,
  active/inactive lifecycle, no name uniqueness) with fixed categories
  `RAW_MATERIAL`/`SEMI_FINISHED`/`FINISHED_PRODUCT` (Žaliava/Pusgaminis/
  Gaminys); `PackingForm` as independent reference data (Dėžė, Maišas, Metalinis
  narvas, Rulonas) with an explicit idempotent seed (`pnpm seed:reference`) — not
  a resource property. `GET/POST/PATCH /resources` and `/packing-forms`; UI
  `/resources`, `/resources/new`, `/resources/[id]`, `/resources/packing-forms`;
  navigation `Ištekliai`. Docs: `resources.md`, `domain-glossary.md`.
- **User administration fix + ADMIN role UX (ATV-017 / O-053)** — root-caused the
  `Naudotojai` edit/disable failures to Fastify's CORS default methods
  (`GET,HEAD,POST`); fixed by setting allowed methods explicitly (browser
  `PATCH` now works everywhere). Enforced ADMIN dominance server-side
  (`normalizeRoleKeys`), added last-active-admin + self-admin-change guards,
  the `Įjungti` label, specific error mapping and immediate table refresh.

## CURRENT

- **Business-domain modules review.** Partners, resources, categories and
  packing forms are implemented and awaiting review. No other business scope is
  confirmed (goods receipt, purchasing, stock, quantities, orders and sales are
  explicitly out of scope). The partner/resource/receipt relationship is not
  implemented or designed.

## NEXT (only with a confirmed requirement)

1. Security hardening of the existing auth scope (rate limiting; http-only
   cookie) — **needs confirmation**.
2. Any new functional scope — **none confirmed**. Requires a confirmed
   requirement and a new task; do not infer from `/sandelys`.

## LATER / DISCOVERY ONLY (not approved, do not build)

The items below come from legacy discovery. They are **unconfirmed** and must
not be promoted into current/next work:

- inventory / stock lots, locations, catalog, units;
- orders, order lines, dispatch/sales;
- discrepancies/errors, barcode workflows, reporting;
- Sandėlys integration/adapter, data migration, synchronisation;
- tenant/company architecture; background processing; observability; deployment.

See `docs/first-slice-readiness.md` (candidate slices; **none selected**) and
`docs/data-ownership.md` (ownership matrix; **no ownership decided**). Any move
to build one of these starts with a confirmed requirement and a recorded task,
and must follow `docs/legacy-as-reference.md` (ADR-004).

## Open questions (do not answer without evidence)

- Business answers on ownership/write authority
  (`docs/business-decisions.md`, workspace O-036) — unrelated to identity but
  required before any future data scope.
- Which Sandėlys instance(s) are canonical (workspace O-021).
