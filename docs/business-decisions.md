# Business Decisions — Questionnaire

> **Status: open questionnaire — NOT an approved roadmap.** See `scope.md`. These
> questions are unanswered; nothing here is a commitment.

> Decision-preparation document (O-035). These are the questions the
> **business/owner** must answer before Aitvaras can own data or integrate with
> Sandėlys. Phrased in business language. **No answers are assumed or
> fabricated.** Record answers in the space provided (or in a copy); each answer
> unlocks part of `data-ownership.md`.
>
> Context for every question: today the warehouse runs on Sandėlys. Aitvaras is
> the new system; at first it does not need to touch Sandėlys at all. The goal
> is to decide, concept by concept, **which system is the single place where
> that concept is recorded** ("who writes it") and what the other system may see.

## How to use

- Answer at the business level; "we don't know yet" is a valid answer and marks
  the item as still open.
- Where a question is marked **[blocking]**, a first Aitvaras feature cannot be
  built until it is answered.
- Keep the wording: "one place writes it" is the core rule.

---

## A. Overall direction

- **A1 [blocking].** Once Aitvaras is live, do you expect Sandėlys to still be
  used at all? For how long, and for what?
- **A2 [blocking].** Should Aitvaras *replace* Sandėlys for day-to-day warehouse
  work, or *add* a parallel capability at first?
- **A3.** Which single business outcome should Aitvaras deliver first?
- **A4.** Who is the business owner of this transition, and who can make the
  ownership calls below?

_Answers:_

---

## B. Stock and warehouse operations

- **B1 [blocking].** Once Aitvaras is live, which system registers **new stock**
  (new lots/parcels)? Can both systems ever register stock at the same time?
- **B2.** During transition, must operators keep using Sandėlys for movements
  (transfers, sorting, packing, receive)?
- **B3.** Is historical stock **movement** data required in Aitvaras? If yes,
  how far back?
- **B4.** Are the physical **places/workstations** (S1, R1/R2, P1/P2, place
  groups, place 40) the same for every company/site, or specific to each?
- **B5.** Are **weight vs pieces** both required on every lot, or does it depend
  on the goods?
- **B6 [blocking].** What does a **barcode** mean to the business: the identity
  of one lot, a family/lineage of lots (parent and split children), or just
  something printable to scan?
- **B7.** Must **old barcodes continue to resolve** forever (e.g. on a shelf
  label printed years ago)? If yes, in which system?
- **B8.** Are "in transit" states (`kelyje`) actually used in daily work, or do
  goods move directly between places?
- **B9.** Are sorting/packing **errors/discrepancies** still recorded? Do they
  affect pay or accounting? (If unused, this concept is retired.)

_Answers:_

---

## C. Orders and dispatch (atkrovimai)

- **C1.** Are customer **orders** part of Aitvaras's scope in the first phase,
  later, or not at all?
- **C2.** Are **buyers** per company/site, or shared?
- **C3.** At cutover, what happens to **open orders** — finished in Sandėlys or
  moved to Aitvaras?
- **C4.** Is historical **dispatch/sales** data required in Aitvaras for
  accounting or audit? How far back?
- **C5.** Is partial sale/dispatch (splitting an order across shipments) a real,
  frequent need?

_Answers:_

---

## D. Partners and reference dictionaries

- **D1.** Are supplier records clean enough to carry over? Are any suppliers
  shared across companies/sites?
- **D2.** Are product **types/categories** and package/container weights the
  same for every company/site?
- **D3.** Do you need Aitvaras to keep the **same codes/names** (e.g. `CEMA`,
  `TSXX`), or may Aitvaras use clearer names as long as they map to the old ones?

_Answers:_

---

## E. People and access

- **E1.** When Aitvaras starts, who should be able to log in, and with what
  (new accounts, or single sign-on)?
- **E2.** Which job roles really exist in practice, and what may each role do?
  (Legacy has six roles; they may not match reality.)
- **E3.** Must an action in Aitvaras be attributable to the same person as in
  Sandėlys for historical continuity?

_Answers:_

---

## F. History and audit

- **F1.** Is a trustworthy, non-deletable history of changes a business
  requirement (e.g. for disputes or accounting)?
- **F2.** What history must be visible in Aitvaras: recent only, or all of it?
- **F3.** Do you need to see *who* did *what*, including corrections and
  reversals?

_Answers:_

---

## G. Instance / company scope

**Known facts (from discovery, not decisions):** production currently has seven
independent Sandėlys copies/databases on one server — `main`, `af`, `gb`, `dev`,
`lt`, `ltn`, `pl`. They share a schema but have separate data. `gb` is the
busiest; the root `main` is effectively inactive; `lt`/`ltn` run the newest
code. No single "canonical" copy has been confirmed.

- **G1 [blocking].** Which of these are **still operationally relevant** today,
  and which are historical/test?
- **G2 [blocking].** Which **one** should Aitvaras serve first?
- **G3 [blocking].** Should Aitvaras be **single-company** at first, or
  multi-company/site from the start?
- **G4.** Should "company/site/tenant" be an explicit concept in Aitvaras, or is
  one Aitvaras deployment per company acceptable?
- **G5.** After migration, must the link to the **old instance** be preserved
  (e.g. for reporting or audit)?
- **G6.** Does historical data from **inactive** copies matter, or can it be
  abandoned?

_Answers:_

---

## H. Transition execution

- **H1.** When Aitvaras starts owning a concept (e.g. new stock), should
  Sandėlys become **read-only** for that concept immediately?
- **H2.** Is a brief period of **parallel running** acceptable/desired, or must
  there be a clean cutover?
- **H3.** Who decides when a concept is "migrated", and what evidence is needed
  to accept it?
- **H4.** Is there a hard deadline or event driving the transition?

_Answers:_

---

## Decision recording

For each answered question, the ownership matrix entry in `data-ownership.md`
moves from `business decision required` to `confirmed`, and the chosen
transition mode in `transition-model.md` is applied. Any answer that changes an
architectural assumption requires an ADR (proposed until accepted by the owner).

## Related documents

- `data-ownership.md`, `transition-model.md`, `first-slice-readiness.md`
- `integration-boundaries.md`, `identity-strategy.md`
- ADR-003 (proposed), ADR-005 (accepted), ADR-006 (proposed)
