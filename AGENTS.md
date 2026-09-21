# AGENTS.md — Aitvaras

Operating rules for agents working in the `/aitvaras` repository. Keep this file
concise and operational; put durable knowledge in `docs/`.

## What this repository is

- Aitvaras is the **future Alfasis warehouse application**, a clean replacement
  for the legacy `/sandelys` system. It is **not** "Sandėlys v2" and **not** a
  1:1 rewrite.
- It has its own web app, its own API and its **own PostgreSQL database**.
- Business behaviour must come from **confirmed requirements and real warehouse
  workflows**, never from assuming legacy code is a specification. The strategy
  is fixed by the workspace ADR-001.
- **The only confirmed functional scope is identity and access management**
  (`docs/scope.md`). Everything else — inventory, stock, orders, sales,
  suppliers, buyers, warehouse movements, barcode workflows, reporting, tenant
  architecture, Sandėlys integration, migration, synchronisation — is
  **unconfirmed discovery** and must not be built or planned. Candidate modules
  and first slices in `docs/` are evidence, not a roadmap.

## Boundaries

- `/sandelys` is an **active production system**. Do not modify it from this
  repository. Do not read or write legacy production databases unless a task
  explicitly authorises it and the access is encapsulated behind an adapter.
- Never let legacy table names, column names, IDs or SQL leak into Aitvaras core
  domain logic. See `docs/integration-boundaries.md`.
- This repo is independent from `/sandelys` and from the workspace root. Check
  which `.git` a file belongs to before staging anything.

## Stack constraints

- TypeScript, Node.js >= 22, **pnpm** workspaces. Use `pnpm`, not npm/yarn.
- Web: Next.js App Router + Tailwind CSS, shadcn/ui-compatible structure.
- API: NestJS with the Fastify adapter.
- Database: PostgreSQL via Prisma. Aitvaras owns its schema.
- Shared validation: Zod in `@aitvaras/contracts`; NestJS DTOs at API edges.
- Tests: Vitest.

Do not add infrastructure (Redis, queues, Kafka, Kubernetes, microservices,
etc.) without a concrete, current requirement recorded in a task. Prefer the
smallest solution that works.

## Architectural principles

- Simple dependency direction: `web → api → application/domain → database /
  integrations`.
- Keep `@aitvaras/contracts` a thin home for shared schemas/types. It is not a
  dumping ground for internal code.
- Keep integration code isolated in an `integrations/` area; core domain code
  must not import it directly.
- Prefer explicit, small, reviewable changes over speculative abstraction.

## Sandėlys is a reference, not a blueprint (project-wide)

Aitvaras is designed from first principles. `/sandelys` is a discovery source
(terminology, workflows, stored data, edge cases, integration/migration needs) —
never the architectural, technical or domain-design blueprint.

- Classify every legacy behaviour before reuse: confirmed business requirement /
  current operational convention / legacy implementation detail / workaround /
  historical artifact / unknown (needs business confirmation).
- Do not reproduce legacy numeric status ids, hardcoded role/place ids,
  database-driven implicit rules, fat controllers, schema coupling, legacy
  auth/deployment patterns, the legacy barcode generator, or Laravel/MySQL
  limitation assumptions merely because they exist.
- Never justify an Aitvaras decision solely with "Sandėlys does it this way".
  Justify with business requirements, domain correctness, maintainability,
  security, performance, simplicity, testability or operational needs.
- `Legacy table != Aitvaras entity`; `column != required field`;
  `id != identity`; `workflow != required workflow`.
- When legacy informs a decision, document **Observed in Sandėlys / Business
  requirement / Aitvaras decision / Rationale**.
- When uncertain, record the question instead of copying legacy.

Full rule: `docs/legacy-as-reference.md`; workspace ADR-004.

## Dependency freshness

For a new Aitvaras component, **prefer the current stable, supported version** of
a dependency. Breaking changes alone are **not** sufficient justification for
pinning an older major in a greenfield project.

- Pin an older major only for a verified compatibility, security, operational or
  ecosystem reason, and document it (ADR or package note).
- Never depend on an unpinned `latest`; check that the `latest` tag is not a
  prerelease. Pin exact versions.
- Record deliberate older-major pins and the conditions that would allow the
  upgrade.

## NestJS structure

- Feature/domain modules live under `apps/api/src/modules/<feature>/`.
- Infrastructure adapters live under `apps/api/src/infrastructure/<adapter>/`.
- Cross-cutting technical helpers live under `apps/api/src/common/`
  (`decorators/`, `guards/`, `validation/`). **No domain logic in `common/`.**
- `AppModule` composes modules and wires global providers; no business logic.
- Do not create empty architecture scaffolding — add directories with real code.

## User identity and roles

- `username` is an **authentication identifier, not a person's display
  identity**. User-facing/reporting identity uses `firstName` + `lastName`
  (separate fields).
- Keep the **relational** access model (`User`/`Role`/`UserRole`); do not replace
  it with a single role field or numeric ids. `RoleKey` is the canonical stable
  role identifier; multiple roles per user are supported.
- **`ADMIN` dominates.** Normalize every role assignment with
  `normalizeRoleKeys` (`@aitvaras/contracts`): `ADMIN` plus any other role is
  stored as `ADMIN` alone. Enforce this **server-side** (create and update); the
  UI only mirrors it. Never persist a redundant mixed set.
- **At least one role** per user is required (`roles: []` is invalid).
- **Never allow zero active administrators.** Reject deactivating the last
  active `ADMIN` or removing `ADMIN` from them, and reject an admin changing
  their own admin access/active state. See `docs/authorization.md`.

## Development ports

Default Aitvaras local ports are **API `3010`** and **Web `3011`**, both
configurable (`API_PORT`; web dev `--port`). Do not assume the conventional
`3000` in scripts, docs or defaults.

## UI language

All user-facing UI text is **Lithuanian**; code identifiers, API paths, database
fields and enum keys remain **English**. There is no i18n framework yet —
multi-language support is not a confirmed requirement. Use the centralised
`ROLE_LABELS` mapping in `@aitvaras/contracts` for role display; never show raw
role keys such as `WAREHOUSE_WORKER` to users.

**User-facing Lithuanian terminology** — technical identifiers in English,
user-facing Lithuanian terminology in Lithuanian:

```text
Role    → Vaidmuo
Roles   → Vaidmenys
Status  → Būsena
Statuses→ Būsenos
```

Use these when rendering or documenting visible UI labels. Legacy terms
(`Rolė`, `Rolės`, `Statusas`, `Statusai`) must not appear in user-facing text.

## UI style

Default visual direction is **minimalist, high-contrast monochrome** (white,
black, grey). Use colour only for semantic meaning (errors, warnings, success,
status, destructive actions). Do not introduce gradients, colourful dashboards,
illustrations, or new design systems/palettes without a confirmed requirement.

## Brand assets

Use the approved Aitvaras assets from `apps/web/public/brand`. **Do not generate
substitute logos or replace the brand assets without an explicit requirement.**
Prefer the symbol for compact contexts, the horizontal logo for wide contexts,
and the stacked logo only where vertical space makes it appropriate. Render logos
with `next/image` at sensible CSS sizes (not raw source dimensions); do not
recolour the source assets. See `docs/branding.md`.

## Development credentials

`localdev` / `localdev` exists **only** for local development via
`pnpm seed:dev`, which refuses to run unless `NODE_ENV=development` and the
database is local. Never reuse development credentials in staging or
production. The secure `pnpm bootstrap:admin` (env-supplied credentials, no
defaults) remains a separate mechanism.

## Browser authentication

- Never store auth tokens in `localStorage` or `sessionStorage`. Browser
  authentication uses the approved **httpOnly cookie** mechanism
  (`aitvaras_access`; ADR-011), sent with `credentials: "include"`.
- Do not return the raw token in the login response body or log tokens/cookies.

## Login security

Do not weaken: generic login failures (unknown user / wrong password / inactive
/ locked must be indistinguishable), login rate limiting/lockout, cookie security
attributes (`HttpOnly`, `SameSite=Lax`, `Secure` in production), or server-side
role guards. Cookie policy decisions (CORS, CSRF) are in ADR-011.

## UX

Password fields that support manual entry should provide an accessible show/hide
control (with Lithuanian `aria-label`s) unless there is a specific reason not to.

## Navigation and application shell

- Authenticated pages use the shared application shell
  (`components/layout/app-shell.tsx`); do **not** duplicate header markup per
  page.
- **Navigation must contain only implemented and confirmed functionality.** Do
  not add placeholder links for future business domains.
- Menu visibility (e.g. `Naudotojai` for ADMIN) is a UI convenience only;
  server-side authorization remains authoritative and must never be weakened.

## Self-service profile

- `/profile` is self-service for the authenticated user: first/last name are
  editable; `username` and roles are read-only.
- Password changes require verification of the current password. Never return or
  log passwords.
- The server derives the user from the authenticated identity; the client never
  sends a user id, and self-profile cannot change roles, active state or
  username.

## Migrations

Before first release, deliberate migration cleanup is allowed. **After migrations
have been used in a shared or production environment, never rewrite applied
migration history** — add a new migration instead.

## Test database isolation

- Test code must **never** mutate the normal development database.
- Any test requiring database mutation must use the dedicated test database
  (`TEST_DATABASE_URL`, `aitvaras_test`) and pass the test-database safety guard.
- Never fall back to the development `DATABASE_URL`; a missing `TEST_DATABASE_URL`
  is a hard error.
- Never make a destructive test preserve development records as a workaround for
  missing isolation.

## Testing expectations

- Add or update tests for behaviour you implement.
- Run the canonical check before claiming completion:

  ```bash
  pnpm verify
  ```

- If a check cannot run (missing service, offline, etc.), state exactly why.
- See `docs/testing.md` for test layers.

## Documentation expectations

- Durable facts, assumptions and open questions go in `docs/` and must be
  clearly separated.
- Architecture changes go in `docs/architecture.md`; boundary decisions in
  `docs/integration-boundaries.md`.
- Do not present guesses as confirmed facts.

## Task workflow

- One task at a time. Active task lives in `tasks/current/`; completed tasks are
  archived to `tasks/done/` with: objective, implemented work, decisions, files
  changed, verification, unresolved issues and recommended next task.
- Keep `TODO.md` current: distinguish **DONE / CURRENT / NEXT / LATER**.
- Do not leave a stale task in `tasks/current/`.

## Git safety

- **Do not commit or push unless explicitly instructed.** Leave changes
  uncommitted for review by default.
- Never stage files across repository boundaries.
- Do not rewrite history, force-push or modify Git configuration.

## Secrets and configuration

- Never commit secrets, credentials, DSNs, keys or tokens.
- Use `.env.example` for required configuration; real values stay in `.env`
  (git-ignored) or an approved secret store.
- Treat production and real data conservatively; no production actions without
  an explicit authorising task.
