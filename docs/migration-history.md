# Migration history remediation

## Reported issue

`prisma migrate dev` refused to run and asked to reset the development database
because the applied migration `20260930160000_piece_batches` was modified after it
had been recorded in `_prisma_migrations`.

The refusing message was:

```text
The migration `20260930160000_piece_batches` was modified after it was applied.
We need to reset the "public" schema at "127.0.0.1:5432"
```

Resetting was **not** performed. No operational data was deleted.

## Cause

The `piece_batches` migration was applied on 2026-10-06, then its SQL file was
edited during the follow-up PIECE-batch work (the file now contains the final
`batch_items` shape, including the void fields/constraints). Prisma stores the
checksum of the SQL file at apply time:

| Item | Checksum |
|---|---|
| Stored in history (old, drifted) | `4aaff16b755d0246f033901cfa383ab49feae018b71306e031a2186af7235433` |
| Current `migration.sql` | `47ce544b76c70dfd472e0b7c1b9ed706a7478d3863b2a0386ba27b5013c4e942` |

A checksum comparison of every migration existing at that time showed **only this
one** differed; the other 20 migrations matched exactly. (The history has since
grown to 22; see the later audit below.)

## Safety checks before correction

1. Inspected the actual `batches` and `batch_items` schema in the development
   database. Both match the current migration file:
   - `batch_items` has `voided_by_id`, `voided_at`, `void_reason`;
   - the batching mode, document metadata and foreign keys are present.
2. Confirmed no migration was half-applied (`_prisma_migrations` row has
   `finished_at` and `applied_steps_count = 1`).
3. Took a full custom-format backup before the corrective database operation:

   ```text
   docker exec aitvaras-postgres pg_dump -U aitvaras -d aitvaras -Fc \
     -f /tmp/aitvaras_pre_migration_repair_20261117.dump
   ```

   Backup copy:
   `C:\Users\msmig\AppData\Local\Temp\opencode\aitvaras_pre_migration_repair_20261117.dump`
   (75,195 bytes at the time of the operation; the dump includes
   `_prisma_migrations` with the old checksum).

## Correction

The schema already reflected the current file, so re-running the migration would
have failed on existing objects. The minimal, data-preserving remediation was to
make migration history agree with the file that is actually represented in the
database:

```sql
UPDATE _prisma_migrations
SET checksum = '47ce544b76c70dfd472e0b7c1b9ed706a7478d3863b2a0386ba27b5013c4e942'
WHERE migration_name = '20260930160000_piece_batches'
  AND checksum = '4aaff16b755d0246f033901cfa383ab49feae018b71306e031a2186af7235433';
```

This was run against the development database and the isolated test database
(`aitvaras_test`), one row each. The old checksum is preserved in the backup.

## Verification

- Re-ran a full SHA-256 comparison of migration files against
  `_prisma_migrations`: **no drift, no missing migrations**.
- Ran the normal workflow:

  ```bash
  npm run db:migrate
  ```

  Result:

  ```text
  Already in sync, no schema change or pending migration was found.
  ```

- `npm run verify` afterwards applies migrations to the test database and passes.
- Development data after remediation remains: 2 partners, 10 deliveries,
  19 batches, 26 bags, 9 batch items and 8 goods receipts; no counts were changed
  by the checksum correction.

## Later audit (2026-11-17)

Current history has **22 migrations**, ending with `company_settings`. A replay of
all 22 migrations against a disposable empty database succeeded
(`prisma migrate status`: “Database schema is up to date!”), and the recorded
checksums match the files on disk. The disposable database was dropped afterwards;
the working development database was not reset or destructively modified.

## Forward rule

Once a migration has been applied in a shared or production environment, its SQL
must not be edited. Add a new migration instead. This remediation was limited to
pre-release local development history and was explicitly documented rather than
silently rewritten.
