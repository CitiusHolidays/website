# High-risk coverage policy

`bun run coverage:check` runs the full isolated Bun suite with LCOV output, writes
`coverage/lcov.info` plus `coverage/coverage-summary.json`, and enforces the reviewed policy in
`config/release/coverage-risk-policy.json`. Generated Convex output, Next/build artifacts, tests,
fixtures, E2E, dependencies, and the separately locked Studio are excluded from product coverage.

The ratchet owns line and function floors for six high-risk seams: command receipts, Commercial
Files authorization, bounded import workers, notification cleanup, payment verification, and portal
permission parity. Floors were established from a current measured run and cannot be reduced by the
command. A policy edit is an explicit reviewed baseline change, not a routine way to make a failure
green.

The Bun 1.4.0 to 1.4.4 upgrade was one such reviewed change. Bun 1.4.4 counts executable lines
differently: the same tests leave the same regions uncovered, but `commandReceipts.ts` now reads
57/60 (95%, was 64/67) and `commercialFilePolicy.ts` 93/112 (83.04%, was 122/137). Those two line
floors were re-measured on 1.4.4; no test or covered branch was removed.

Bun 1.4.4 LCOV exposes line and function counters but not numeric branch counters. The same full
successful suite therefore reports branch evidence as 29 required named contract tests across
payment failure/success, role boundaries, replay conflicts, bounded import failures, notification
cleanup, and file policy. Removing or renaming a required branch contract fails closed. Browser
workflow coverage remains the separate Playwright matrix; line coverage never substitutes for an
authenticated scenario.

Bun 1.4.4 also writes an LCOV record for every loaded module with no functions (`FNF:0`), such as
`convex/_generated/api.js`. The parser treats a zero denominator as nothing to cover; a ratcheted
file that reports one still fails.

Coverage output is ignored local evidence and is never uploaded. Compare `durationMs` across
representative runs before changing feedback-loop design; there is no runtime budget yet.
