# ATV-031 — Warehouse-worker receiving UI (`Registruoti sandėlyje`)

- **Status:** done (uncommitted; for human review)
- **Scope:** role-specific UI follow-up on the ATV-029/030 receiving model
- **Depends on:** ATV-029 (batches/bags), ATV-030 (reconciliation)

## Objective

Give the warehouse worker a focused, task-oriented workplace for the **physical**
receiving step, without exposing the formal `Pajamavimas` / documentary /
reconciliation flow. No reconciliation-semantics, batch/bag data-model,
GoodsReceipt-relationship or authorization changes.

## Decisions

- **Scope the flow by role at the UI layer only.** The physical step (create a
  batch, register bags) is `ADMIN`/`WAREHOUSE_WORKER`; the existing server rules
  are untouched. The receiving route is wrapped in `AppShell roles={RECEIVING_ROLES}`
  (client-side convenience); server authorization stays authoritative.
- **Worker home replaces the generic greeting.** For a receiving role, the home
  is a focused workplace whose primary action is a prominent
  `Registruoti sandėlyje` button leading to `/receiving`. The greeting stays;
  other roles keep the generic home.
- **Single simplified flow with two modes.** `/receiving` supports `Nauja partija`
  (supplier, resource, warehouse, arrival date — the minimum a worker knows) and
  selection of an existing open `PENDING` batch. After creating/selecting, the
  supplier/resource/warehouse are **inherited** and never re-entered.
- **Fast repeated bag entry.** The bag form has only `Svoris` and `Vieta`; on save
  the unique barcode is generated, the label preview appears immediately, focus
  returns to the weight field, and the batch context (bag count/measured) refreshes.
- **Navigation is role-scoped.** A new `excludeRoles` nav rule hides `Pajamavimas`
  from `WAREHOUSE_WORKER`; a new `Registruoti sandėlyje` item is shown to
  `ADMIN`/`WAREHOUSE_WORKER`. `ADMIN` keeps all existing access and the formal flow.
- **Formal fields never appear in the worker flow.** Documentary weight,
  acquisition amount, document number/date and reconciliation controls remain on
  the ADMIN batch-detail flow.

## Files changed

- New: `features/home/{index.ts,lib/home.ts,lib/home.test.ts,ui/home-page.tsx}`;
  `features/manage-batches/lib/receiving.ts` (+test);
  `features/manage-batches/ui/{bag-label.tsx,receiving-page.tsx}`;
  `app/receiving/page.tsx`.
- Changed: `entities/batch/batch.ts` (+test) — `RECEIVING_ROLES`, `RECEIVE_ACTION`,
  `canReceiveStock`; `widgets/app-shell/model/navigation.ts` (+test) — `excludeRoles`
  + `Registruoti sandėlyje`, `Pajamavimas` hidden from workers;
  `features/manage-batches/index.ts` (export `ReceivingPage`);
  `features/manage-batches/ui/batch-details-page.tsx` (use the extracted `BagLabel`);
  `app/page.tsx` (use `HomePage`).
- Docs: `docs/batches.md`, `docs/domain-glossary.md`, `docs/authorization.md`,
  `TODO.md`; this record.

## Tests

- `entities/batch/batch.test.ts` (+3): receiving roles, `canReceiveStock`,
  action label/route.
- `widgets/app-shell/model/navigation.test.ts` (+2, 1 updated): `Registruoti
  sandėlyje` visibility, `Pajamavimas` hidden from workers, focused worker
  navigation, admin list includes `/receiving`.
- `features/home/lib/home.test.ts` (+2): home shows the receiving action only for
  receiving roles.
- `features/manage-batches/lib/receiving.test.ts` (+9): modes, open-batch filter,
  inherited batch context, label data (barcode + batch code + weight + resource),
  and that formal reconciliation fields are disjoint from the worker fields.

No brittle CSS-class tests; all assertions are on pure helpers/constants.

## Verification

- `pnpm verify` green: contracts **64**, web **154** (was 138), API **169**;
  lint, Prisma validate, typecheck and Next + Nest builds.
- `git diff --check` clean; `/sandelys` untouched; no commit/push.

## Limitations

- Server-side authorization is unchanged; the route/nav gating is a UI
  convenience. A non-receiving role reaching `/receiving` sees the client 403
  screen, and any mutation would still be rejected by the API.
- `Pajamavimas` is hidden from the worker's **navigation**, not removed from the
  app; the worker could still reach `/receipts` by URL (server unchanged). This
  task intentionally did not change authorization.
- Reference lists (`Partneriai`, `Ištekliai`, `Sandėliai`) remain visible to the
  worker as read reference data.
- Barcode labels still print the value as text (no scannable graphic, no printer
  hardware).
