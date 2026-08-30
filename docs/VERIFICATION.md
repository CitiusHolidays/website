# Verification authority

This reference names what each repository command proves. `package.json` owns
the executable script definitions; this page owns the evidence vocabulary.

| Evidence state | Command or action | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Source orientation | `bun run repo:orient` | The current Git revision/branch/tracked-tree state and ownership-critical references can be read from this checkout. | Publication, deployment, migration, browser behavior, or any hosted target state. |
| Focused unit/contract evidence | `bun run test -- <path...>` | The named test seams pass under the repository's isolated Bun configuration. | The full suite, browser behavior, deployment, or production state. |
| Full unit/contract evidence | `bun run test` | All discovered isolated Bun tests and schema-backed Convex integration tests pass; Playwright specs remain excluded. | Authenticated interaction, a build, or a deployed target. |
| Fast local quality evidence | `bun run check` | Raw lint, the lint ratchet, the full isolated Bun coverage suite, the schema-backed Convex integration suite, and reviewed high-risk coverage floors pass. | Type generation, Studio, asset/performance budgets, deployment, or browser proof. |
| Local release evidence | `bun run verify:local` | The required target-neutral quality gate passes for the current working tree/revision: zero-warning lint, ownership-critical docs, application and Convex typechecks, all target-neutral tests, and coverage. | Diff, asset, configuration, audit, Studio-build, performance, deployment, or authenticated-production evidence. |
| Hosted credential-free evidence | GitHub `Hosted Quality` for the exact revision | The same pinned-Bun required quality command ran from a clean clone: zero-warning lint, ownership-critical docs, both typechecks, all target-neutral tests, and coverage. | Diff, assets, configuration, dependency audits, a Studio build, performance measurement, target-aware codegen, deployment, migration, or authenticated browser proof. |
| CI-gated Vercel deployment evidence | `Vercel Deploy After Hosted Quality` for the exact successful Hosted Quality run | The exact green SHA was built and deployed prebuilt to the named activated GitHub/Vercel environment. | Browser behavior, migration correctness, Production authority for a Preview run, or external GitHub/Vercel policy configuration. |
| Authenticated interaction evidence | `bun run test:e2e:smoke`, `bun run test:e2e:critical`, or `bun run test:e2e:workflow` | The selected Playwright tag ran against the explicitly configured non-production or authorized target. | Untested roles/actions, deployment health outside the scenario, or production proof. |
| Target-aware generation/build evidence | Identify the target, run environment preflight, then use the reviewed codegen/build command from [release operations](../RELEASE.md). | Generated bindings and the build match the named target and command. | Deployment completion, migration completion, or signed-in workflow behavior. |
| Git publication evidence | Record the commit, remote, branch, ancestry, and successful push. | The named Git ref reached the remote. | Vercel or Convex deployment. |
| Deployment evidence | Record provider deployment IDs, target, commit, and completion state. | The named frontend/backend revision completed deployment to the named environment. | Authenticated role behavior or migration correctness. |
| Public browser proof | Run the public smoke against the named URL and record results. | Public navigation and the selected anonymous checks work at that URL. | Staff or Customer Account behavior. |
| Authenticated production proof | With fresh explicit Production authority, run the smallest safe signed-in role journey and record target, role, commit, and result. | That exact authorized production journey worked. | Other roles, workflows, data migrations, or general production health. |

## Decision tree

1. During implementation, run focused tests for the changed seam.
2. Before review, run `bun run check` and the relevant independent typecheck.
3. Before merge or release, run `bun run verify:local` once on the complete
   candidate change.
4. Stop before codegen, build, migration, deploy, or browser work until the
   exact target and authority are explicit. Follow [RELEASE.md](../RELEASE.md).
5. Report every achieved evidence state separately. A later state never
   retroactively proves an earlier command ran, and a local pass never implies
   publication or deployment.

Credential-dependent Playwright skips are not passing interaction evidence.
Use the strict mode documented in [E2E testing](E2E_TESTING.md) when a run is
intended to prove a configured role/target rather than list optional coverage.

`bun run verify:local -- --metrics .scratch/dx-metrics/verify.json` retains schema-versioned,
monotonic per-gate durations and the first failed/skipped reason. It contains revision/fingerprint,
outcomes, and durations only—never environment values, command output, CRM data, hardware identity,
or upload behavior. Timings are measurement evidence, not a performance budget.

`bun run verify:local -- --evidence auto` writes a disposable, revision-bound JSON bundle in the
ignored local release-evidence area and prints a summary generated from that same bundle. The local adapter
populates only the `local` scope; Git push, Preview/Production deploys, public/authenticated smokes,
and migrations remain `not_run` until their own command adapters record evidence. Use `-` instead of
`auto` for JSON stdout. Never infer a non-local proof state from this file.

Before review, `bun run release:scope -- --base <sha>` provides read-only range accounting and
target-neutral command suggestions. It does not infer a release base or contact Convex/Vercel.
