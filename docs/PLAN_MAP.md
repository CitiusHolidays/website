# Plan and issue handoff map

The repository no longer carries the historical `plans/` directory. Those files were local
execution notes, not a release artifact, and were removed when the work was consolidated into
permanent product documentation and GitHub Issues. This map keeps old links
actionable without recreating a second plan system.

## Canonical locations

| Need | Use | Lifetime |
| --- | --- | --- |
| Domain vocabulary and invariants | [`CONTEXT-MAP.md`](../CONTEXT-MAP.md), its linked glossaries, and [`docs/adr/`](adr/) | Permanent, reviewed with code |
| Product or technical rationale | [`docs/prd/`](prd/) and [`docs/`](./) | Permanent |
| Design authority | [`DESIGN.md`](../DESIGN.md) | Permanent router to scoped design owners |
| Staff Workspace performance and replay-safety contract | [`STAFF_WORKSPACE_PERFORMANCE.md`](STAFF_WORKSPACE_PERFORMANCE.md) and `config/release/staff-workspace-performance-*.json` | Permanent, refreshed with monitored code |
| Published specifications and implementation tickets | GitHub Issues following [`docs/agents/issue-tracker.md`](agents/issue-tracker.md) | Canonical live status |
| Local briefs, evidence, handoffs, and working notes | `.scratch/<feature>/` following the [change-program brief](agents/change-program-brief.md) | Local and disposable after handoff |
| Release and deployment contract | [`RELEASE.md`](../RELEASE.md) and [`config/release/`](../config/release/) | Permanent |

Do not add a new `plans/` directory. If a workflow asks for a plan, publish the durable decision
in a PRD/ADR or docs page, publish implementation-ready tickets to GitHub when
authorized, and keep local evidence/handoffs in `.scratch/`.

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
