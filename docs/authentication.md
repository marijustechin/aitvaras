# Authentication

> Confirmed scope: identity and access management only (`scope.md`). No business
> functionality is implemented.

## Model

- **User** (`users`): Aitvaras-owned UUID `id`, unique `username` (the login
  credential), `firstName` / `lastName` (the person's real display identity),
  `passwordHash`, `active`, timestamps.
- **Role** (`roles`): stable semantic `key` (`RoleKey` enum, e.g. `ADMIN`),
  display `name`.
- **UserRole** (`user_roles`): explicit many-to-many assignment.

`username` is an **authentication identifier, not a display name**. Screens,
reports and audit trails display `firstName` + `lastName`.

Persistence uses **Prisma ORM 7** with the PostgreSQL driver adapter (ADR-008);
the auth code lives in `apps/api/src/modules/auth`.

Passwords are hashed with **Argon2id** via `@node-rs/argon2`. Hashes never leave
the API and are never logged.

## Browser authentication: httpOnly cookie

The browser never receives a readable token. On successful login the API issues
a JWT and delivers it **only** as an httpOnly cookie
(`aitvaras_access`). See ADR-011.

| Attribute | Value | Rationale |
|---|---|---|
| `HttpOnly` | yes | JavaScript cannot read the token (XSS token theft mitigation) |
| `Secure` | `NODE_ENV === "production"` | HTTPS-only in production; local dev is plain HTTP |
| `SameSite` | `Lax` | Blocks cross-site state-changing requests; see CSRF below |
| `Path` | `/` | Sent to the API on all routes |
| `Max-Age` | `JWT_ACCESS_TTL` (default 3600 s) | Aligns cookie life with token life |

No auth token is stored in `localStorage` or `sessionStorage`, and the web client
never builds an `Authorization` header.

## Login lifecycle

```http
POST /auth/login
Content-Type: application/json

{ "username": "localdev", "password": "…" }
```

- On success → `200` with **safe user data only** (no token):

  ```json
  {
    "user": {
      "id": "…", "username": "localdev",
      "firstName": "Local", "lastName": "Developer", "roles": ["ADMIN"]
    }
  }
  ```

  plus `Set-Cookie: aitvaras_access=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`.
- On any failure → `401` with a **generic** `"Invalid credentials"` message.
  Unknown user, wrong password, inactive account and temporary lockout are
  indistinguishable to the caller.

Authenticated requests send the cookie automatically (`credentials: "include"`);
`GET /auth/me` returns the current safe user.

### Token source priority (server)

The global `JwtAuthGuard` accepts, in order: (1) the `aitvaras_access` **cookie**
(canonical browser auth); (2) an `Authorization: Bearer <jwt>` header (retained
only for API clients/tooling). The browser never uses the bearer source.

### JWT

- Algorithm `HS256`; signing secret from `JWT_SECRET` (required, ≥ 32 chars).
- Short-lived; TTL from `JWT_ACCESS_TTL` seconds (default 3600).
- Claims remain minimal: `sub`, `username`, `roles`, plus `iat`/`exp`. Names are
  **not** in the token; clients read them from `/auth/me`.
- **No refresh tokens** (ADR-011): on expiry the user signs in again.

## Self-service profile

```http
PATCH /auth/me
```

Authenticated. Updates **only the current user** (derived from the session; the
client never sends a user id). Body:

- `firstName` / `lastName` — optional; trimmed, non-empty, ≤ 100 chars;
- `currentPassword` + `newPassword` — to change the password; the current
  password must verify against the stored hash (wrong value → `400`), and the new
  password follows the existing policy (≥ 8 chars).

`roles`, `active` and `username` are **not** accepted (the request schema is
strict; unknown keys are rejected with `400`). Returns the updated safe user.

## Logout

```http
POST /auth/logout   → 200 { "success": true }
```

Clears the auth cookie with matching attributes (`Path=/`) via `Set-Cookie`
expiry. The web UI (`Atsijungti`) calls this and returns to `/login`. Because
JWTs are stateless, the previously issued token remains cryptographically valid
until it expires; the short TTL bounds this. This is an accepted property, not a
client-only logout.

## Session expiry UX

When the token/cookie expires, authenticated API calls return `401`; the web app
clears its session state and redirects to `/login` (no redirect loop, no stale
authenticated UI). Users simply sign in again (no refresh tokens).

## Login brute-force protection

A process-local limiter (`LoginAttemptService`) tracks failures per username and
per client IP within a sliding window and temporarily locks a key at the
threshold. Defaults (env-configurable):

| Variable | Default | Meaning |
|---|---|---|
| `LOGIN_MAX_ATTEMPTS` | `5` | failures before temporary lockout |
| `LOGIN_WINDOW_SECONDS` | `900` | failure-counting window |
| `LOGIN_LOCKOUT_SECONDS` | `900` | how long a locked key stays locked |

Counters reset on successful login and after the window/lockout expires. Locked
attempts return the **same generic** `401` — the client cannot tell that an
account exists or is locked. Accounts are never permanently locked.

**This limiter is in-memory and therefore per-instance**; a shared store (e.g.
Redis) would be required for multi-instance deployments. It is intentionally not
added yet (no verified need).

## CSRF assessment

Cookie auth changes the threat model. Decision: **`SameSite=Lax` plus a
same-site deployment is sufficient for the current architecture; no CSRF token is
used.** Reasoning:

- The web app and API are intended to be **same-site** (e.g. `localhost:3011` →
  `localhost:3010` in dev; one site in production). Ports do not affect the
  SameSite "site" boundary.
- `SameSite=Lax` cookies are **not sent on cross-site subrequests/POSTs**, so a
  third-party page cannot trigger an authenticated state-changing request.
- CORS is explicit and credentialed (`credentials: true`) with **no wildcard
  origin**, so a foreign origin cannot read responses either.

If the deployment ever moves the API to a **different site** (which would require
`SameSite=None; Secure`), a CSRF token (double-submit or synchroniser) becomes
necessary and must be added deliberately.

## CORS

- Explicit allowed origins from `WEB_ORIGIN` (comma-separated); the default
  includes `http://localhost:3011`.
- `credentials: true`; a wildcard origin is rejected at startup.
- Origins remain environment-driven for production.

## Password visibility toggle

The Lithuanian login form's password field has an accessible show/hide control
(`type="button"`, `aria-label` `Rodyti slaptažodį` / `Slėpti slaptažodį`). It
only toggles `type="password"` ↔ `type="text"` and never submits the form.

## Bootstrap the first user

### Local development seed (weak, guarded)

```bash
pnpm seed:dev      # creates/ensures localdev / localdev (ADMIN, active)
```

- Development only: refuses unless `NODE_ENV=development` and `DATABASE_URL` is
  local. Idempotent; never run at API startup.
- `localdev` / `localdev` must never be reused outside local development.

### Secure admin bootstrap (production)

```bash
# .env (git-ignored)
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_FIRST_NAME=<first name>
BOOTSTRAP_ADMIN_LAST_NAME=<last name>
BOOTSTRAP_ADMIN_PASSWORD=<strong password, >= 12 chars>

pnpm bootstrap:admin
```

Requires all four variables, is idempotent, and never uses `localdev` as a
fallback. `BOOTSTRAP_ADMIN_*` are **optional** and not required for normal
development; they are not default local credentials.

In development the login screen shows a muted hint (`Lokali paskyra: localdev /
localdev`); it is omitted from production builds.

## Configuration

| Variable | Required | Meaning |
|---|---|---|
| `JWT_SECRET` | yes | JWT signing secret (≥ 32 chars) |
| `JWT_ACCESS_TTL` | no | Access token / cookie lifetime in seconds (default 3600) |
| `WEB_ORIGIN` | no | Allowed credentialed CORS origins (no `*`) |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_SECONDS` / `LOGIN_LOCKOUT_SECONDS` | no | Login protection policy |
| `BOOTSTRAP_ADMIN_*` | bootstrap only | Initial admin credentials |

Secrets live in `.env` (git-ignored); `.env.example` documents them with
placeholders.

## Security properties (verified by tests)

- passwords are never stored or returned in plaintext; hashes are never returned;
- login failures are generic (unknown user / wrong password / inactive / locked);
- the token is delivered only via httpOnly cookie and never in the JSON body,
  `localStorage` or `sessionStorage`;
- protected endpoints reject unauthenticated requests (`401`); role checks remain
  server-side;
- the JWT secret is required from the environment; request bodies are validated;
  credentials and tokens are not logged.

## Current limitations / next hardening

- No refresh tokens; re-login on expiry (accepted, ADR-011).
- Rate limiting is in-memory/per-instance (documented above).
- No password reset, MFA, SSO or invitations (not confirmed requirements).
