---
artifact_kind: implementation_spec
readiness: draft
implementation_authorized: false
source_issue: "None: issue not created"
verified_revision: ""
---

# Specification title

Choose `research`, `decision_handoff`, or `implementation_spec` and retain only that kind's required
sections. Do not set authorization true until the user confirms an approved implementation spec.

## Target user and job

Describe who needs to accomplish what.

## Verified current state

State observed behavior at the verified revision. Separate facts from inference.

## Desired behavior

Describe user-visible and system behavior without prescribing incidental implementation details.

## Why now

Name the urgency, risk, or opportunity.

## Observable completion

Describe what a reviewer can observe when the work is complete.

## Scope

List included surfaces and explicit non-goals. UI work links `docs/agents/ui-change-brief.md`.

## Preservation constraints

Name behavior, data, permissions, layouts, and operational boundaries that must not change.

## Dependencies

Reference `#<ticket>` entries, or write `None:` followed by the reason.

## Failure modes and rollback

Describe partial failure, recovery ownership, and the smallest safe rollback.

## Repository references

List every source-of-truth repository path in backticks and verify it exists.

## Acceptance criteria

- [ ] Replace this instruction with a measurable observable outcome.

## Proof boundaries

### Local/source proof

Name automated checks and source evidence.

### Preview proof

Name required Preview checks or explain why they do not apply.

### Production proof

Name separately authorized Production evidence or state that it is absent.

## UI extension

Answer the relevant `docs/agents/ui-change-brief.md` headings inline, reference the completed brief,
or write `N/A:` followed by the reason.
