# High-risk coverage policy

`bun run coverage:check` runs the policy-owned Bun tests with LCOV output, writes
`coverage/lcov.info` plus `coverage/coverage-summary.json`, and enforces the reviewed policy in
`config/release/coverage-risk-policy.json`. `bun run check`, `bun run verify:local`, and Hosted
Quality run the full isolated Bun suite before this focused coverage pass. Generated Convex output,
Next/build artifacts, tests, fixtures, E2E, dependencies, and the separately locked Studio are
excluded from product coverage.

The ratchet owns line and function floors for six high-risk seams: command receipts, Commercial
Files authorization, bounded import workers, notification cleanup, payment verification, and portal
permission parity. Floors were established from a current measured run and cannot be reduced by the
command. A policy edit is an explicit reviewed baseline change, not a routine way to make a failure
green.

Bun 1.4.0 LCOV exposes line and function counters but not numeric branch counters. The same focused
successful suite therefore reports branch evidence as 29 required named contract tests across
payment failure/success, role boundaries, replay conflicts, bounded import failures, notification
cleanup, and file policy. Removing or renaming a required branch contract fails closed. Browser
workflow coverage remains the separate Playwright matrix; line coverage never substitutes for an
authenticated scenario.

Coverage output is ignored local evidence and is never uploaded. Compare `durationMs` across
representative runs before changing feedback-loop design; there is no runtime budget yet.
