# Dead-code inventory

The repository uses the exact Knip version in `package.json` and the explicit
entry-point model in `knip.jsonc`. The first pass is report-only: do not use
Knip's fix or file-removal flags from this workflow.

## Commands

- `bun run deadcode` prints the current framework-aware inventory.
- `bun run deadcode:ratchet` rejects any finding outside the reviewed allowlist.
- `bun run deadcode:ratchet:update` may initialize or shrink the allowlist; it
  refuses to widen it.

The baseline in `config/release/deadcode-baseline.json` fingerprints findings
without source positions, so unrelated line shifts do not churn the inventory.
It also binds to the hash of `knip.jsonc`; configuration changes require an
intentional review.

## Initial classification

The current reviewed inventory contains 183 findings: 122 unused exports, 28
unused exported types, 5 unused files, 11 development dependencies, 9
unresolved command-path references, 5 dependencies, and 3 duplicate exports.
The first run also exposed 59 real unlisted imports: `jsdom` in mounted tests and
`dompurify` in the assistant sanitizer. Those packages are now direct, exact
dependencies. The mounted-test runtime now owns exact `jsdom@30.0.1` directly;
unused `isomorphic-dompurify` and the unreachable direct Resend facade were removed. The
unresolved inventory includes the same reviewed CLI-test limitation for the target-neutral
migration rehearsal planner. CLI-test unresolved rows are not permission to delete their package
script entrypoints.

The remaining list is a triage queue, not deletion authority. In particular,
Next route discovery, Convex public functions, test helpers, generated or
registry-driven exports, package-script tools, dynamic imports, Studio security
pins, and externally invoked hooks require owner confirmation at their actual
runtime seam before removal. Each future cleanup should remove one bounded,
verified family and then shrink the baseline.
