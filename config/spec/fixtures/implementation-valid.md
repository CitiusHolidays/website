---
artifact_kind: implementation_spec
readiness: approved
implementation_authorized: true
source_issue: "#168"
verified_revision: 1d7192c
---

# Enforce spec readiness

## Target user and job

Maintainers need to classify a handoff before assigning implementation.

## Verified current state

GitHub Issues are canonical and local `.scratch` artifacts are non-authoritative.

## Desired behavior

One explicit command validates one spec without scanning ignored artifacts.

## Why now

Broad handoffs need a deterministic structural gate before execution.

## Observable completion

The documented valid fixture exits successfully and an invalid fixture exits non-zero.

## Scope

Add the tracked contract, validator, fixtures, tests, and issue template.

## Preservation constraints

Do not create `plans/`, file GitHub issues, or infer product approval.

## Dependencies

None: the local contract has no runtime dependency.

## Failure modes and rollback

A false positive blocks publication only; revert the validator change to restore the prior workflow.

## Repository references

- `docs/PLAN_MAP.md`
- `docs/agents/issue-tracker.md`

## Acceptance criteria

- [ ] `bun run spec:check -- config/spec/fixtures/implementation-valid.md` exits zero.
- [ ] Passing two paths is rejected before either file is read.

## Proof boundaries

### Local/source proof

Focused validator tests and the exact command are required.

### Preview proof

Not applicable: this contract has no deployed behavior.

### Production proof

Not applicable: this contract must not claim deployment evidence.

## UI extension

N/A: this tooling-only contract does not change a user interface.
