# Specification readiness and handoff

This contract classifies a local artifact before it becomes a canonical GitHub issue. It is a
structural readiness gate, not product approval. GitHub Issues remain the live ticket system;
`.scratch/` remains local evidence and handoff space; durable decisions belong in tracked product
docs or ADRs. Do not create a `plans/` tree.

## Artifact kinds

| Kind | Purpose | Required profile | May authorize implementation |
| --- | --- | --- | --- |
| `research` | Evidence, source characterization, or an open question | Question, findings, repository references, evidence boundaries | No |
| `decision_handoff` | Options and a recommendation awaiting or recording a product/domain decision | Decision needed, options, recommendation, repository references, evidence boundaries | No |
| `implementation_spec` | A bounded change an unfamiliar implementer can execute | Full implementation profile below | Only with explicit user confirmation |

Every artifact begins with YAML frontmatter containing `artifact_kind`, `readiness`,
`implementation_authorized`, `source_issue`, and `verified_revision`. Use a commit SHA for a clean
snapshot or `working-tree:<base-sha>` for reviewed uncommitted work. `source_issue` is `#<number>`, a
GitHub issue URL, or `None: <reason>` while no ticket exists.

## Readiness and authorization

The only readiness values are `discovery`, `needs_decision`, `draft`, `approved`, `ticketed`,
`completed`, and `superseded`.

| State | Meaning | Authorization rule |
| --- | --- | --- |
| `discovery` | Evidence is being gathered | Always false |
| `needs_decision` | A named choice blocks a complete spec | Always false |
| `draft` | Structurally shaped but not approved | Always false |
| `approved` | A human reviewed the bounded content | True only for a user-confirmed `implementation_spec`; otherwise false |
| `ticketed` | The approved spec has a canonical GitHub ticket | True only for a still-active user-confirmed `implementation_spec` |
| `completed` | The described work and required proof are complete | False; history is not fresh authority |
| `superseded` | A newer artifact owns the decision or work | False |

Normal transitions are discovery to needs-decision or draft, needs-decision to draft, draft to
approved, approved to ticketed, and approved/ticketed to completed or superseded. Moving an
implementation spec to approved and setting authorization true requires explicit user confirmation.
Repository evidence can answer technical questions; it cannot manufacture product approval.

## Implementation profile

An `implementation_spec` answers five questions first: target user and job, verified current state,
desired behavior, why now, and observable completion. It then locks scope, preservation constraints,
dependencies, failure modes and rollback, repository references, measurable acceptance criteria,
and separate local, Preview, and Production proof boundaries. Multi-ticket specs name issue
dependencies rather than relying on prose order.

For UI-affecting work, attach the [UI change brief](ui-change-brief.md). The UI brief extends this
generic contract; it is not a competing template. Backend-only work may say `N/A: <reason>` for UI
requirements. Current Staff Workspace and Customer Account layouts are preserved unless a reviewed
spec explicitly authorizes new visual direction.

## Structural check

Run exactly one explicit artifact:

```sh
bun run spec:check -- .scratch/<feature>/spec.md
```

The command does not scan `.scratch/`, call the network, edit a file, file an issue, or infer
semantic quality. It fails closed on invalid metadata/state combinations, missing required sections,
unresolved placeholder markers, broken backticked repository paths, unreferenced dependencies,
missing measurable acceptance criteria for authorized work, or collapsed proof scopes.

Passing means structurally valid. It does not mean correct, redacted, approved, deployed, or proven
in a browser. A human still owns draft review, privacy review, product/domain approval, GitHub dedupe,
and publication.

For an explicitly authorized `implementation_spec`, render the reviewed GitHub body with
`bun run spec:render-issue -- <exact-spec.md>`. Rendering is deterministic and writes only to
stdout; it does not publish, call `gh`, create a second tracker, or supply completion/deployment
proof. GitHub mutation remains a separate authority-bound action under
[`issue-tracker.md`](issue-tracker.md).

## Existing artifact classification

These historical local examples motivated the contract. Their old prose is not retroactive
authorization.

| Historical example | Classification | Why |
| --- | --- | --- |
| `.scratch/post-mp4-remediation/spec.md` | `implementation_spec` / approved | Approved remediation program with bounded outcomes; executable only under its original explicit authority |
| `.scratch/t3code-staff-workspace-2026-08-08/spec.md` | `implementation_spec` / completed | Successful parent spec and dependency-aware ticket graph; completion is evidence, not reusable authority |
| `.scratch/razorpay-customer-account-publishing/spec.md` | `decision_handoff` / needs-decision | Missing product/data-state decisions explicitly defer implementation |
| `.scratch/travel-feature-research-2026-08-06/spec.md` | `research` / discovery | Evidence-only scan whose anecdotes do not authorize a feature |

Use [the reusable template](templates/spec.md) for new artifacts and the
[implementation-spec GitHub template](../../.github/ISSUE_TEMPLATE/implementation-spec.md) when
publishing an approved handoff.
