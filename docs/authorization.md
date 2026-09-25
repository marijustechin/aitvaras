# Authorization

> Confirmed scope: identity and access management and **business partners**
> (`scope.md`). No other business functionality is implemented.

## Roles

Roles are **configuration**, not legacy semantics. They use stable string keys
(no numeric ids with implicit meaning). The four confirmed initial roles:

| Key | Label (lt) |
|---|---|
| `ADMIN` | Administratorius |
| `WAREHOUSE_WORKER` | Sandėlio darbuotojas |
| `ACCOUNTING` | Apskaita |
| `PRODUCTION_MANAGER` | Gamybos vadovas |

The catalogue is defined once in `@aitvaras/contracts` (`ROLE_KEYS`) and seeded
idempotently into the `roles` table at startup
(`modules/access/role-catalog.ts`). Users may hold multiple roles (`UserRole`).

`RoleKey` is the **canonical stable role identifier**. It exists as a PostgreSQL
enum (Prisma `RoleKey`) and as the shared runtime constant `ROLE_KEYS` in
`@aitvaras/contracts`; a test keeps the two in sync. Roles remain **relational**
(`Role` + `UserRole`) rather than a single column on `User`, so a user may hold
several roles and roles can later gain metadata or permissions.

UI displays the **Lithuanian label** from `ROLE_LABELS`; the raw keys
(`ADMIN`, `WAREHOUSE_WORKER`, …) are code/API/database semantics and are never
shown to users. The UI is Lithuanian only; there is no i18n framework (ADR-010).

The guards and decorators live in `apps/api/src/common/guards` and
`apps/api/src/common/decorators` because they are generic application security
primitives; the role catalogue is owned by `apps/api/src/modules/access`.

## Route protection

Authorization is centralised, not scattered through controllers:

- **`JwtAuthGuard`** (global) authenticates every request by default. Routes
  marked `@Public()` are exempt (e.g. `/health`, `/auth/login`). It authenticates
  from the **httpOnly auth cookie** (canonical browser source); an
  `Authorization: Bearer` header is still accepted for API/tooling clients only.
- **`RolesGuard`** (global, runs after authentication) enforces `@Roles(...)`
  metadata. A route with no `@Roles` needs only authentication; a route with
  roles requires the user to hold **at least one** of them.
- **`@Roles('ADMIN')`** — declarative requirement.
- **`@Public()`** — no authentication.
- **`@CurrentUser()`** — injects the authenticated user (`id`, `username`,
  `roles`).

Example:

```ts
@Controller("users")
@Roles("ADMIN")           // every route on this controller is admin-only
export class UsersController { … }
```

The guards are unit-tested independently of any business module
(`src/common/guards/*.guard.test.ts`) and exercised end-to-end in
`test/auth.e2e.test.ts` / `test/users.e2e.test.ts` (cookie-authenticated).
Login brute-force protection and generic login failures are documented in
[authentication.md](authentication.md).

## Role normalization and administrative safety

- **`ADMIN` dominates.** `ADMIN` includes full application access, so assigning
  it together with any other role is normalized to **`ADMIN` alone** — on user
  creation, on user update, and therefore for direct API requests. The single
  rule lives in `normalizeRoleKeys` (`@aitvaras/contracts`) and is enforced
  **server-side**; the UI only mirrors it (checking `Administratorius` clears
  and disables the other role controls).
- **At least one role is required.** `roles: []` is rejected (`400`).
- **Never zero active administrators.** Deactivating the last active `ADMIN`, or
  removing the `ADMIN` role from them, is rejected with `409 Conflict` and a
  specific Lithuanian message (`Negalima išjungti paskutinio aktyvaus
  administratoriaus.` / `Negalima pašalinti paskutinio aktyvaus
  administratoriaus vaidmens.`).
- **No self admin change.** An administrator cannot remove their own admin
  access or deactivate their own account (auth cookies are not invalidated when
  `active` changes, so self-deactivation would leave an incoherent session);
  rejected with `409`.

**Navigation visibility is a UI convenience only.** Menu items (e.g.
`Naudotojai` for `ADMIN`) are hidden from users without the role, but the server
remains authoritative: a non-admin who requests `/admin/users` is still denied.
**Self-service** (`PATCH /auth/me`) cannot change roles, active state or
username; role management stays ADMIN-only via `/users`.

## Initial capabilities

| Capability | Endpoint | Requirement |
|---|---|---|
| Authentication | `POST /auth/login` | public |
| Logout | `POST /auth/logout` | public (clears cookie) |
| Current user | `GET /auth/me` | authenticated |
| List users | `GET /users` | `ADMIN` |
| Create user | `POST /users` | `ADMIN` |
| Update roles / active | `PATCH /users/:id` | `ADMIN` |
| Reset user password | `PATCH /users/:id/password` | `ADMIN` |
| List partners | `GET /partners` | authenticated |
| Partner details | `GET /partners/:id` | authenticated |
| Create partner | `POST /partners` | `ADMIN` |
| Update partner (roles / active / data) | `PATCH /partners/:id` | `ADMIN` |
| List resources | `GET /resources` | authenticated |
| Resource details | `GET /resources/:id` | authenticated |
| Create resource | `POST /resources` | `ADMIN` |
| Update resource (category / active / data) | `PATCH /resources/:id` | `ADMIN` |
| List packing forms | `GET /packing-forms` | authenticated |
| Packing-form details | `GET /packing-forms/:id` | authenticated |
| Create packing form | `POST /packing-forms` | `ADMIN` |
| Update packing form (name / active) | `PATCH /packing-forms/:id` | `ADMIN` |
| List receipts | `GET /receipts` | authenticated |
| Receipt details | `GET /receipts/:id` | authenticated |
| Create receipt | `POST /receipts` | authenticated |
| List warehouses (with locations) | `GET /warehouses` | authenticated |
| Warehouse details | `GET /warehouses/:id` | authenticated |
| Create warehouse | `POST /warehouses` | `ADMIN` |
| Update warehouse (name / active) | `PATCH /warehouses/:id` | `ADMIN` |
| List warehouse locations | `GET /warehouses/:id/locations` | authenticated |
| Create warehouse location | `POST /warehouses/:id/locations` | `ADMIN` |
| Update warehouse location (name / active) | `PATCH /warehouses/:warehouseId/locations/:locationId` | `ADMIN` |

## Failure behaviour

| Situation | Response |
|---|---|
| No/invalid/expired token or cookie on a protected route | `401 Unauthorized` |
| Authenticated but missing the required role | `403 Forbidden` |
| Unsafe role change (last active admin, self admin change) | `409 Conflict` |
| Any login failure (unknown/wrong/inactive/locked) | `401` (generic) |

## Limitations / next steps

- No permission model finer than roles (no per-resource permissions); none is
  confirmed as required. Partner/resource/packing-form viewing is
  authenticated-only and modification is `ADMIN`-only, using the same role
  guard. Goods receipts (`Pajamavimas`) are listable/readable/creatable by any
  authenticated user — it is expected to become an operational warehouse
  workflow, so creation is deliberately not `ADMIN`-restricted. Warehouse
  master data (warehouses/locations) is listable/readable by authenticated
  users and modifiable by `ADMIN` only.
- Role changes take effect at the user's next login/token expiry.
- The web UI hides admin pages from non-admins and shows an access-denied state,
  but **the server is the enforcement point** — UI checks are convenience only.
