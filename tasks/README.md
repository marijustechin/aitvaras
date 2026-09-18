# Tasks

Task journal for the Aitvaras project.

```text
tasks/
├── current/    the one active task (or empty)
└── done/       archived completed tasks
```

## Conventions

- IDs use the `ATV-NNN` prefix and are **unique and never reused**.
- Exactly one task is active at a time in `current/`.
- Completed tasks are moved to `done/` with the full record:
  objective, implemented work, decisions, files changed, verification,
  unresolved issues and recommended next task.
- No stale duplicate task may remain in `current/` after completion.

This mirrors the workspace-level harness in
`../../docs/system/harness.md`, adapted to the Aitvaras repository.
