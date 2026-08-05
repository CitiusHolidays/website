# Plan and issue handoff map

The repository no longer carries the historical `plans/` directory. Those files were local
execution notes, not a release artifact, and were removed when the work was consolidated into
permanent product documentation and the `.scratch/` issue tracker. This map keeps old links
actionable without recreating a second plan system.

## Canonical locations

| Need | Use | Lifetime |
| --- | --- | --- |
| Domain vocabulary and invariants | [`CONTEXT.md`](../CONTEXT.md) and [`docs/adr/`](adr/) | Permanent, reviewed with code |
| Product or technical rationale | [`docs/prd/`](prd/) and [`docs/`](./) | Permanent |
| Implementation tickets and evidence | `.scratch/<feature>/` following [`docs/agents/issue-tracker.md`](agents/issue-tracker.md) | Local, disposable after handoff |
| Release and deployment contract | [`RELEASE.md`](../RELEASE.md) and [`config/release/`](../config/release/) | Permanent |

Do not add a new `plans/` directory. If a workflow asks for a plan, publish the durable decision
in a PRD/ADR or docs page and put implementation-ready tickets and evidence in `.scratch/`.

## Legacy plan pointers

The following entries replace references that used to resolve under `plans/`:

| Legacy pointer | Replacement |
| --- | --- |
| `plans/001-land-ts-migration-branch.md` | [`docs/prd/typescript-effect-migration.md`](prd/typescript-effect-migration.md) and [`docs/adr/0004-typescript-first-effect-adoption.md`](adr/0004-typescript-first-effect-adoption.md) |
| `plans/002-razorpay-webhook-error-responses.md` | [`docs/BOOKING_PAYMENT_TRANSITIONS.md`](BOOKING_PAYMENT_TRANSITIONS.md) and the payment/webhook contract tests under `src/app/api/payments/` and `convex/` |
| `plans/003-workspace-anyrecord-phase1.md` | [`docs/PORTAL_CRM_WORKFLOWS.md`](PORTAL_CRM_WORKFLOWS.md), [`docs/CONVEX_RETURN_CONTRACTS.md`](CONVEX_RETURN_CONTRACTS.md), and the current portal workspace contracts |
| `plans/004-effect-adoption-audit.md` | [`docs/adr/0004-typescript-first-effect-adoption.md`](adr/0004-typescript-first-effect-adoption.md) and the guardrails in [`AGENTS.md`](../AGENTS.md) |
| `plans/005-portal-workspace-contract-tests.md` | [`docs/prd/portal-crm-motion-craft.md`](prd/portal-crm-motion-craft.md), [`docs/PORTAL_PERMISSIONS_ARCHITECTURE.md`](PORTAL_PERMISSIONS_ARCHITECTURE.md), and focused `src/lib/portal` tests |
| `ceo-plans/20260708-ts-effect-migration-review.md` | The decision and guardrails are retained in [`docs/prd/typescript-effect-migration.md`](prd/typescript-effect-migration.md); no private review file is required to execute the work |

The old names may remain in historical issue prose where they explain origin, but every actionable
link must point to this map or to the replacement document above.

## Proposal Handoff language

Use **Proposal Handoff** for the transition in which Contracting sends a pricing-complete Proposal
to Sales. A Proposal must have selling price and cost price per person before handoff. “Mark client
sent” is not a Proposal state; client communication is handled by the owning Sales workflow. See
the canonical glossary entry in [`CONTEXT.md`](../CONTEXT.md) and the operational flow in
[`docs/PORTAL_CRM_WORKFLOWS.md`](PORTAL_CRM_WORKFLOWS.md).
