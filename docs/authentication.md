# Authentication

> Confirmed scope: identity and access management only (`scope.md`). No
> business functionality is implemented.

## Model

- **User** (`users`): Aitvaras-owned UUID `id`, unique `username` (the login
  credential), `firstName` / `lastName` (the person's real display identity),
  `passwordHash`, `active`, timestamps.
- **Role** (`roles`): stable semantic `key` (`RoleKey` enum, e.g. `ADMIN`),
  display `name`.
- **UserRole** (`user_roles`): explicit many-to-many assignment (a user may hold
  several roles).

`username` is an **authentication identifier, not a display name**. Screens,
reports and audit trails display `firstName` + `lastName`.

Persistence uses **Prisma ORM 7** with the PostgreSQL driver adapter (ADR-008);
the auth code lives in `apps/api/src/modules/auth`.

Passwords are hashed with **Argon2id** via `@node-rs/argon2`. Hashes never leave
the API and are never logged.

## Password hashing

`apps/api/src/auth/password.ts` uses Argon2id with OWASP-baseline parameters:

| Parameter | Value |
|---|---|
| algorithm | Argon2id |
| memoryCost | 19456 KiB (19 MiB) |
| timeCost | 2 |
| parallelism | 1 |

Hashes encode their own parameters, so these can be raised later without
invalidating existing passwords. Comparison is always done by the hashing
library (`verifyPassword`), never by custom code.

## Login lifecycle

```http
POST /auth/login
Content-Type: application/json

{ "username": "alice", "password": "…" }
```

- On success → `200`:

  ```json
  {
    "accessToken": "<jwt>",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "user": {
      "id": "…",
      "username": "alice",
      "firstName": "Alice",
      "lastName": "Anderson",
      "roles": ["ADMIN"]
    }
  }
  ```

- On failure → `401` with a **generic** `"Invalid credentials"` message. Unknown
  user, wrong password and inactive user are indistinguishable.
- Requests requiring authentication use `Authorization: Bearer <token>`.
- `GET /auth/me` returns the current safe user (`id`, `username`, `roles`).

### JWT

- Algorithm `HS256`; signing secret from `JWT_SECRET` (required, ≥ 32 chars).
- Short-lived access token; TTL from `JWT_ACCESS_TTL` seconds (default 3600).
- Claims remain minimal: `sub` (user id), `username`, `roles`, plus `iat`/`exp`.
  Names are **not** placed in the token; clients read them from `/auth/me`.
- Signature and expiration are validated on every protected request.
- **No refresh tokens** in this foundation: the access token is short-lived and
  the user signs in again on expiry. Adding refresh tokens is a deliberate later
  decision (see Limitations).

## Bootstrap the first user

There is no default account and no silent startup creation. There are two
separate mechanisms:

### Local development seed (weak, guarded)

```bash
pnpm seed:dev      # creates/ensures localdev / localdev (ADMIN, active)
```

- Development only: refuses to run unless `NODE_ENV=development` and
  `DATABASE_URL` points at a local database.
- Idempotent; never run at API startup.
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

The script:
- ensures the initial role catalogue exists;
- creates one `ADMIN` user with the given real names and a hashed password;
- is idempotent (skips if the username already exists);
- refuses to run without username, first name, last name and password, and
  requires a ≥ 12-char password;
- never uses `localdev` as a fallback.

It is **not** run automatically by the application.

## Configuration

| Variable | Required | Meaning |
|---|---|---|
| `JWT_SECRET` | yes | JWT signing secret (≥ 32 chars) |
| `JWT_ACCESS_TTL` | no | Access token lifetime in seconds (default 3600) |
| `BOOTSTRAP_ADMIN_USERNAME` | bootstrap only | Initial admin username |
| `BOOTSTRAP_ADMIN_FIRST_NAME` | bootstrap only | Initial admin first name |
| `BOOTSTRAP_ADMIN_LAST_NAME` | bootstrap only | Initial admin last name |
| `BOOTSTRAP_ADMIN_PASSWORD` | bootstrap only | Initial admin password (≥ 12 chars) |

Secrets live in `.env` (git-ignored); `.env.example` documents them with
placeholders. Generate a secret with e.g. `openssl rand -base64 48`.

## Security properties (verified by tests)

- passwords are never stored or returned in plaintext;
- password hashes are never returned by any endpoint;
- unknown user / wrong password / inactive user all fail with `401` and an
  identical generic message;
- protected endpoints reject unauthenticated requests (`401`);
- the JWT secret is required from the environment (application fails to start
  without a valid one);
- request bodies are validated; credential fields are not logged.

## Current limitations / next hardening

- The web client stores the access token in `localStorage`. Moving it to an
  **http-only cookie** via a Next.js route handler is a planned hardening step.
- **No rate limiting / lockout** on `/auth/login` yet. This is the next security
  hardening step; it is not introduced here to avoid unrelated infrastructure.
- Roles in the token reflect assignment **at login time**; a change takes effect
  at the next login or token expiry.
- No password reset, MFA, SSO/OAuth, invitations or profiles (not confirmed
  requirements).
- No refresh tokens.
