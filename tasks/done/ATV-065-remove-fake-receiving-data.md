# ATV-065 — Remove fake receiving data and prepare for real receiving

- **Status:** READY_FOR_HUMAN_REVIEW (uncommitted)
- **Date:** 2026-11-18
- **Scope:** working-development database operational receiving data; master data,
  schema and migration history preserved

## Database identity

- Application `DATABASE_URL`: PostgreSQL `127.0.0.1:5432`, database **`aitvaras`**.
- Container: `aitvaras-postgres` (`postgres:17-alpine`, healthy).
- Server query confirmed `current_database() = aitvaras`.

## Backup

- Durable location outside the repository and temporary directories:
  `C:\Users\msmig\AitvarasBackups\aitvaras_pre_real_receiving_20261118-112140.dump`
- Custom-format `pg_dump`, 79,033 bytes.
- SHA-256:
  `89957BA1D0AB71D047680A55B3D06DEE89869D5D3C87622E2AAFF78974132C01`
- Readability verified with `pg_restore -l`; archive reports `dbname: aitvaras`,
  169 TOC entries, custom format, PostgreSQL 17.11.
- Fake-record manifest:
  `C:\Users\msmig\AitvarasBackups\aitvaras_fake_receiving_manifest_20261118-112140.txt`
- Cleanup SQL:
  `C:\Users\msmig\AitvarasBackups\cleanup_fake_receiving_20261118.sql`
- No backup, dump or manifest was added to Git.

## Fake-data identification

All operational receiving rows were created by the development account
`localdev`; every goods receipt was linked only to those batches:

```text
deliveries: 15, created by localdev
batches:    25, created by localdev
receipts:   10; receipts without a localdev-linked batch = 0
suppliers:  Ediltex Ltd. / Nežinomas (test records)
```

No genuine operational records were found. All 15 deliveries and 25 batches were
therefore classified as fake/test receiving data. Master data was preserved.

## Before / after counts

| Table | Before | After |
|---|---:|---:|
| incoming_deliveries | 15 | 0 |
| batches | 25 | 0 |
| bags | 34 | 0 |
| batch_items | 12 | 0 |
| bag_corrections | 3 | 0 |
| goods_receipts | 10 | 0 |
| goods_receipt_lines | 10 | 0 |
| receiving_discrepancies | 6 | 0 |
| discrepancy_settlements | 4 | 0 |
| piece_reconciliation_lines | 1 | 0 |

Preserved master data (unchanged):

| Table | Count |
|---|---:|
| business_partners | 3 |
| resources | 9 |
| resource_categories | 4 |
| packaging_types | 7 |
| warehouses | 2 |
| warehouse_locations | 5 |
| users | 2 |
| roles | 4 |
| user_roles | 2 |
| company_settings | 1 |

## Cleanup method

Executed one explicit SQL transaction (`BEGIN … COMMIT`) with temporary ID tables
for fake deliveries, batches, bags, items, corrections, discrepancies,
settlements, piece lines and receipts. Deletion order respected every FK:

1. settlements;
2. discrepancies;
3. piece reconciliation lines;
4. bag corrections;
5. bags;
6. batch items;
7. batches;
8. receipt lines;
9. receipts;
10. deliveries.

The transaction asserted expected pre-counts, zero operational rows after the
deletes, and unchanged master-data counts before committing. Foreign-key
constraints were not disabled; no reset/truncate was used. Identifier sequences
and the barcode generator were not reset or modified. The barcode generator is
stateless/random; the 34 fake barcodes were removed with their bags and no
sequential reuse mechanism exists.

## Verification

- API stock summary:
  `{"weight":{"quantityKg":"0","value":"0"},"pieces":{"quantity":0,"value":"0"}}`.
- Dashboard cards (after load): `0,000 kg / 0,00 €` and `0 vnt. / 0,00 €`.
- Discrepancy register: `Neatitikimų nėra.`
- Receiving/new: supplier selector contains `Ediltex Ltd.` and `Nežinomas`;
  arrival date defaults to `2026-11-18`.
- Master-data pages: resources 9, warehouses 2, one warehouse locations 2
  (5 total), packaging/tare 7.
- Referential integrity: 0 orphan batches, 0 orphan receipt lines, 0 invalid
  (non-validated) FK constraints.
- Automated tests remain isolated on `aitvaras_test`; the working database was
  not used for test cleanup.
- Restarted both documented dev services (`npm run dev:api`, `npm run dev:web`);
  `/health` returned 200, `/login` rendered, and the working DB remained at zero
  operational rows. No demo receipt is recreated at startup.
- `npm run verify` passed: lint, Prisma validate, typecheck, contracts **104**,
  web **283**, API **245**, builds. Working-DB counts were re-checked afterward
  and remained zero operational rows with unchanged master data.
- `git diff --check` passed.

Screenshot: `docs/screenshots/atv-065/dashboard-zero-stock.png`.

## Outstanding

- Physical printer verification remains unverified; only label preview/print
  preparation has been checked.
- The barcode generator remains random and stateless; exact future-value
  non-reuse cannot be mathematically guaranteed after deleting historical fake
  barcodes, but no sequence or generator state was reset.
