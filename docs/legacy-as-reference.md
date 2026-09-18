# Sandėlys is a Reference, Not a Blueprint

> **Project-wide rule.** Applies to every Aitvaras component and every agent
> working in this repository. Recorded as workspace ADR-004. This is a
> companion to ADR-001 (legacy maintenance, requirements-driven replacement)
> and ADR-002 (Aitvaras baseline stack).

## The rule

`/sandelys` is an existing legacy system and may be used as a **preliminary
reference source** for:

- understanding current business terminology;
- discovering existing workflows;
- identifying data the business currently stores;
- locating historical edge cases;
- understanding current operational practices;
- discovering integration and migration requirements.

It must **not** be treated as the architectural, technical or domain-design
blueprint for `/aitvaras`.

> Aitvaras is a new system designed from first principles.
> Sandėlys tells us how the business works today; it does not dictate how
> Aitvaras must be designed tomorrow.

Every Aitvaras component should use modern, maintainable and efficient
approaches appropriate to the actual requirement, even when Sandėlys implements
the same business concept differently. This applies to application
architecture, database schema, identifiers, API design, authentication and
authorization, validation, business-rule placement, state transitions,
audit/history, barcode handling, error handling, reporting, background
processing, testing, deployment, observability, and UI/UX.

## Legacy behaviour is evidence, not specification

Existing Sandėlys behaviour must be classified as one of:

- **confirmed business requirement**
- **current operational convention**
- **legacy implementation detail**
- **workaround**
- **historical artifact**
- **unknown / requires business confirmation**

Do not automatically reproduce legacy behaviour. The following must **not** be
copied merely because they exist:

- numeric seeded status ids;
- hardcoded role ids;
- hardcoded place ids;
- database-driven implicit business rules;
- fat controllers;
- schema coupling;
- legacy authentication patterns;
- legacy deployment patterns;
- the old barcode-generation implementation;
- assumptions caused by Laravel/MySQL limitations.

Before reproducing any legacy behaviour in Aitvaras, ask:

1. Is this an actual business requirement?
2. Is the business still using it intentionally?
3. Does it still make sense?
4. Can the requirement be modeled more clearly?
5. Is there a safer or simpler modern implementation?

## Domain modeling

Aitvaras must define its own domain model. Legacy tables and models may provide
discovery evidence, but:

```text
Legacy table    != Aitvaras entity
Legacy column   != required Aitvaras field
Legacy ID       != Aitvaras identity
Legacy workflow != required Aitvaras workflow
```

Domain concepts are modeled from their meaning and current business
requirements, not from legacy structure.

## Data model

Aitvaras owns its PostgreSQL schema, designed for:

- explicit constraints;
- clear relationships;
- appropriate uniqueness rules;
- safe money representation;
- meaningful state models;
- traceability;
- migrations;
- performance;
- future maintainability.

Do not mirror the legacy MySQL schema unless a specific integration or migration
requirement justifies a mapping layer.

## Integration boundary

If Aitvaras needs legacy data:

```text
Sandėlys
   ↓
legacy adapter / integration boundary
   ↓
mapping / normalization
   ↓
Aitvaras concepts
```

Legacy implementation details must stop at the integration boundary. They must
not leak into Aitvaras application or domain code. See
[integration-boundaries.md](integration-boundaries.md) and
[identity-strategy.md](identity-strategy.md).

## Migration mindset

The target is **not**:

```text
Sandėlys implemented again in TypeScript
```

The target is:

```text
current business requirements
        +
lessons learned from Sandėlys
        +
modern engineering practices
        ↓
      Aitvaras
```

Where existing Sandėlys behaviour conflicts with a clearer, safer or more
efficient design, **document the difference and surface it for business review
rather than silently copying the legacy behaviour**.

## Required documentation behaviour

Whenever legacy discovery informs an Aitvaras decision, documentation must
distinguish:

- **Observed in Sandėlys** — factual legacy behaviour.
- **Business requirement** — confirmed requirement, where known.
- **Aitvaras decision** — the new design choice.
- **Rationale** — why Aitvaras keeps, changes or removes the legacy behaviour.

Use this framing in domain/workflow/architecture docs and in ADRs. Where the
classification is unknown, record it as a question.

## Agent rule

Agents working on Aitvaras must not justify a design decision solely with:

> "Sandėlys does it this way."

That is discovery evidence, not sufficient architectural rationale. Aitvaras
decisions must be justified by:

- business requirements;
- domain correctness;
- maintainability;
- security;
- performance;
- simplicity;
- testability;
- operational needs.

When uncertain, record the question instead of copying the legacy
implementation.

## Enforcement / review checklist

- [ ] The decision cites a requirement or engineering rationale, **not** legacy
      behaviour alone.
- [ ] Legacy behaviour is classified (requirement / convention / detail /
      workaround / artifact / unknown).
- [ ] No legacy table/column/id/status-code/role-id leaked past the integration
      boundary into domain code.
- [ ] Differences from legacy are documented and surfaced where they need
      business confirmation.
- [ ] Where legacy behaviour is kept, the rationale is explicit.

## References

- Workspace `docs/decisions/ADR-004-sandelys-is-a-reference-not-a-blueprint.md`
- Workspace `docs/decisions/ADR-001-legacy-maintenance-and-aitvaras-replacement-strategy.md`
- `docs/architecture.md`, `docs/integration-boundaries.md`,
  `docs/data-ownership.md`, `docs/identity-strategy.md`
