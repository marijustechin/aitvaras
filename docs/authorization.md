# Authorization

> Confirmed scope: identity and access management only (`scope.md`). No
> business functionality is implemented.

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
| Update roles / active / password | `PATCH /users/:id` | `ADMIN` |

## Failure behaviour

| Situation | Response |
|---|---|
| No/invalid/expired token or cookie on a protected route | `401 Unauthorized` |
| Authenticated but missing the required role | `403 Forbidden` |
| Any login failure (unknown/wrong/inactive/locked) | `401` (generic) |

## Limitations / next steps

- No permission model finer than roles (no per-resource permissions); none is
  confirmed as required.
- Role changes take effect at the user's next login/token expiry.
- The web UI hides admin pages from non-admins and shows an access-denied state,
  but **the server is the enforcement point** — UI checks are convenience only.
