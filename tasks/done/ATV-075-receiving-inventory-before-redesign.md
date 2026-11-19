# ATV-075 — Receiving workflow inventory before redesign

## Objective

Produce a reproducible, documentation-only inventory of the Aitvaras receiving
workflow as it exists in the uncommitted working tree (ATV-066…074), so the same
inventory can be repeated after a redesign and compared by stable ID to find
obsolete code, duplicate workflows and historical compatibility requirements.

Scope: `Priėmimas` from the web app through the API, contracts and database,
including downstream stock valuation, discrepancies, settlements, labels and
receipt-expense allocation. No application code, schema, migration or live record
may change.

## Implemented work

1. **Baseline captured** — branch `main`, HEAD
   `7b4066857b9438f31413f8319460964cef8b82de`, full `git status --porcelain=v1`
   (68 entries at capture: 39 modified, 29 untracked; 71 after this task's three
   documentation files), untracked receiving files listed separately, and a
   fingerprint of 108 receiving-related files with per-file SHA-256 plus an
   aggregate digest
   `74332527353199a95daa3b83177a414ec138c2743512637773bcc0e8ad156dc4`.
2. **UI-inward trace** — route map for all nine receiving/discrepancy routes,
   role/scenario walk for warehouse worker and manager, including empty, pending,
   partially confirmed and fully confirmed receipts and WEIGHT, PIECE and mixed
   receipts. `/receiving` (redirect), `/receiving/new` (record-free form), the
   receipt editor and the batch editor are recorded separately. Every
   `Priėmimų sąrašas` action was traced to `/receipts`.
3. **Code-outward trace** — all receiving API endpoints, guards and handlers
   enumerated from the controllers; each mapped to a web caller, another known
   consumer, or an explicit "no identified caller" finding. Direct-URL-only pages
   identified.
4. **Comparable inventory** — 118 rows with stable IDs (`RCV-NAV/LIST/RCPT/BATCH/
   PHYS/PIECE/LABEL/RECON/DISC/SETTLE/COST/VAL/MODE-nn`), each with entry and
   consumer, implementation, data effects, conditions and evidence; related rows
   cross-linked. A separate calculation register records where each value is
   calculated, persisted and displayed.
5. **Findings** — 29 findings classified as duplicate journey, parallel
   calculation, legacy path, no caller, doc drift, auth, data dependency or
   unresolved, each with what was searched, evidence and remaining uncertainty.
6. **Re-run procedure** — `docs/audits/receiving-inventory-method.md` defines the
   baseline capture, fingerprint, ID rules, inventory columns, roles, scenarios,
   evidence standards, safety rules and the after-redesign comparison protocol.

## Decisions

- The baseline is the **working tree**, not the commit: the receiving changes are
  uncommitted, so the fingerprint (paths + hashes + aggregate) is the identity,
  and the commit hash alone would be misleading.
- IDs describe **behaviour**, never files; they are never renumbered or reused,
  and the after-run marks `UNCHANGED / CHANGED / REMOVED / ADDED / MERGED /
  SPLIT / UNRESOLVED`.
- Evidence is source-first. An authenticated browser walk was **not** performed
  (no browser automation available; no live receipt data read or written). The
  only live observations are the web auth gate on `/receipts` and `401` responses
  from the API without a cookie; all UI claims come from the component source.
- `/receipts/batches/[id]` is treated as a duplicate confirmation journey and a
  no-caller finding, but **not** as safe to delete.
- No TODO/backlog functionality was promoted; the inventory is evidence, not a
  roadmap.

## Files changed

- `docs/audits/receiving-inventory-before.md` (new)
- `docs/audits/receiving-inventory-method.md` (new)
- `tasks/done/ATV-075-receiving-inventory-before-redesign.md` (this record)
- `TODO.md` (DONE/CURRENT/NEXT updated)

No application, contract, schema, migration or data file was modified.

## Verification

`npm run verify` on 2026-11-19: **PASS**.

- `eslint .` — pass
- `prisma validate` — schema valid
- typecheck (contracts, database, api, web) — pass
- API tests — 27 files, 272 tests passed
- web tests — 31 files, 296 tests passed
- contracts tests — 15 files, 104 tests passed
- `db:test:migrate` — 24 migrations, none pending
- `nest build` + `next build` — success, 25 routes

The inventory itself required no writes; live receipts and the development
database were untouched. The same result was reproduced after the two audit
documents and this record were written.

## Unresolved issues

- Authenticated browser walk not performed; six UI-only rows are marked
  `UNRESOLVED (not exercised live)` or rely on source evidence (see the inventory
  §2.4).
- Open questions recorded in the inventory §13 (batch-detail route purpose, list
  access for accounting roles, discrepancy read authorization, WEIGHT
  `documentPieces`, PIECE correction audit, `Neatitikimas` marker, GoodsReceipt
  `unit_price`, re-open policy).

## Recommended next task

Human review and commit of ATV-066…075. After a receiving redesign is confirmed,
repeat `receiving-inventory-method.md` at the new clean baseline and produce
`receiving-inventory-after.md` plus the delta table by stable ID.
