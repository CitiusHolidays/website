# Independent review of the combined PR stack

Two subagents reviewed the combined branch against current main: one checked the requested reversions and user-visible contracts; one reviewed implementation, authorization, and CRM behavior. Both reviewed fixes. No confirmed blocking finding remains.

## Specification review

All 142 inventory entries remain addressable. The requested 13 feature reversions are implemented; dependent CRM lifecycle, MICE draft approvals, Job Card variance/readiness changes, and code migration gates are also reverted. Contact maps are restored. Stable Staff IDs are kept inside APIs while selectors show names. Existing main-era owner references remain editable. Staff and Customer Account remain separate surfaces.

The review led to restoring ordinary Proposal unlink/delete behavior, source deletion with file recovery, default Director Query creation, and legacy owner edits. Staff copy was rewritten in dashboard, activity, customer access, and room-count controls. The full source review included inherited PR #283; no authenticated live acceptance or deployment was performed.

## Complete local verification

Pinned Bun 1.4.0: `bun run verify:local -- --evidence auto` passed on the final source tree. 2,280 Bun tests, 165 Convex tests, zero-warning lint, application and Convex types, ownership documentation checks, and high-risk coverage (6 files, 29 branch contracts) passed. Local evidence identifies `d6c24b0a244f3ea110d98061160dcef873d65cb3+dirty.0a8eace7001f`; source commit `50508855fa827bb6fae563f9d69429d4f72a857f` contains that exact staged tree. The dead-code ratchet also passed: 126 of 183 reviewed findings remain.

Eight current anonymous local captures cover Contact maps, Services desktop/mobile, destinations, company sections, About, Journal, and Vendor sign-in. The earlier 77 examples remain explicitly historical. No screenshot establishes authenticated Staff/Account or deployed backend acceptance.

## Standards review

Reviewed the working tree against `origin/main` (`f1c74ea4a8d6d1fc0ce56d50d50c4fe5354bd216`), with branch HEAD `d6c24b0a244f3ea110d98061160dcef873d65cb3`. Review includes staged and unstaged fixes.

## Remaining findings

No confirmed finding remains after the follow-up fixes. Full local verification passed after the final source edits.

## Resolved findings

- Legacy Query owners map to stable Staff IDs without requiring a reassignment. The default active current user can create a Query as on main, including Directors without a Sales role. Existing owner/name refreshes preserve identity; actual reassignment still requires an active Sales rep.
- Ordinary Proposal handoff no longer permanently prevents deletion or unlinking. Proposal relations, Query/Proposal deletion, Job Card commands, and code allocation match main where the user requested behavior preservation.
- Source deletion no longer requires waiting 14 days. Existing file metadata and storage remain retained for normal expiry cleanup; preview invalidation and ownership tracking remain.
- Proposal relationship edits no longer impose the additional 100-file/25-Job-Card limits; chain keys still update in the same transaction.
- Cement-scoped scorecards omit unsafe inbound cohorts and apply shared Query visibility to backlog drill-downs. The removed revision workflow no longer appears as a ready metric.

## Evidence and limits

Focused Convex checks passed: scorecard 7/7; bounded CRM/default-owner/reassignment tests 6/6. Biome passed for the files changed during these fixes. No full suite was run by this reviewer; root owns the complete verification gate.

The review traced CRM workflows, identity/roles, Account entitlements, auth returns, payment state transitions, file custody/cleanup, and dashboard filtering across the combined stack. Final follow-up concentrated on restored CRM behavior and fixes. No authenticated browser, live deployment, migration, or external-state proof was performed. No speculative abstractions or formatting findings are requested.

## Root follow-up

The remaining replay-command documentation mismatch is corrected. File relationship rekey keeps its atomic access update without the artificial 100-file or 25-Job-Card limits; the expanded integration test passes with 101 historical files and 26 inherited Job Cards. Source deletion regression confirms file recovery is requested before removing a Job Card. Final complete verification is recorded separately.
