# How to prepare a change-program brief

Use one local `.scratch/<feature>/spec.md` brief to review a broad, multi-ticket
change before implementation. The brief is a disposable delivery artifact:
durable product decisions stay in PRDs, ADRs, and domain docs, while published
implementation status lives in GitHub Issues.

## Prerequisites

- Read [the context map](../../CONTEXT-MAP.md) and relevant ADR/PRD sources.
- Read the current executable policy and tests for every authorization or data
  boundary in scope.
- Confirm the requested outcome is measurable and that external writes are
  authorized separately from local planning.

## Steps

1. Create `.scratch/<feature>/spec.md`. Do not create `plans/`.
2. Fill the compact template below. Link durable sources instead of copying
   their full contents.
3. Give each requirement a stable ID and map it to at least one GitHub ticket,
   approved test seam, and proof scope. Mark intentional gaps explicitly.
4. Review blockers and dependencies before publishing or claiming tickets.
5. Keep execution evidence and handoffs beside the local brief; put live ticket
   status only in GitHub Issues.

## Template

```markdown
# Change program: <outcome>

## Context and measurable outcome
## Non-goals
## Durable authorities
- PRD:
- ADR:
- Context/glossary:
- Executable policy/tests:

## Current data and control flow
## Preserved behavior and authorization invariants
## Error, rescue, and rollback
| Failure | User-visible state | Rescue/retry | Rollback boundary |
| --- | --- | --- | --- |

## Observability
## Requirement map
| Requirement | GitHub ticket | Approved test seam | Proof scope |
| --- | --- | --- | --- |

## Dependency order
## Unresolved decisions
## Definition of done
```

Scale the detail to the risk. A documentation-only correction may need one row;
an auth, payment, migration, or multi-service change should name every failure
and recovery boundary.

## Worked example

The 8 August Staff Workspace program used
`.scratch/t3code-staff-workspace-2026-08-08/spec.md` to connect the measurable
route-performance outcome, preserved role/Cement/privacy rules, three approved
test seams, and ten dependency-aware tickets. Its durable outcome now lives in
[Staff Workspace performance and replay safety](../STAFF_WORKSPACE_PERFORMANCE.md);
GitHub issue `#84` and its children own the published implementation history.

## Verification

- Every requirement has a ticket, test seam, and proof scope, or a named gap.
- Rollback/rescue behavior and unresolved product decisions are visible before
  source work begins.
- All durable claims link to tracked sources.
- The brief does not become a second issue tracker or permanent plan tree.

## Troubleshooting

- If two docs claim authority, stop and resolve the owner before writing the
  brief.
- If a requirement needs a production migration or provider change, keep the
  implementation ticket but mark target-bound execution deferred pending fresh
  authority.
- If the ticket graph changes, update GitHub first and treat local copies as
  snapshots or handoffs only.
