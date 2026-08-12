# Release operations

This file is the repository-owned release contract. It records commands and expected scopes; it
does not assert that Vercel, GitHub, Convex, DNS, or provider dashboards are already configured.

The complete local change summary and dated evidence snapshots are in
[`docs/WORKING_TREE_CHANGES.md`](docs/WORKING_TREE_CHANGES.md). Those entries record the last known
result for their stated date and commit; they are not current proof. Vercel/Convex deployment and
live browser checks remain separate external activation work.

The current `main` checkpoint is `7fa38a0` (Staff Workspace scale and retry safety). Its bounded
route budgets, source-hash freshness rule, replay-safe command IDs, durable import/export operations,
and notification delivery ledger are described in
[`docs/STAFF_WORKSPACE_PERFORMANCE.md`](docs/STAFF_WORKSPACE_PERFORMANCE.md).

## Environment ownership

[`config/environment.manifest.json`](config/environment.manifest.json) is the canonical key-only
manifest. [`.env.example`](.env.example) is the blank local template. Values must never be added to
either file.

| Manifest scope | Where the value belongs |
| --- | --- |
| `browser` | Next.js/Vercel environment. Every key is intentionally browser-visible. Never put a secret in a `NEXT_PUBLIC_*` key. |
| `nextServer` | Next.js server/Vercel environment only. |
| `convexRuntime` | The selected Convex deployment's environment settings. Preview and production are separate. |
| `ciDeploy` | Vercel secret or platform/Convex CLI-provided value. |
| `oneTimeOperations` | Convex environment only while the reviewed maintenance/bootstrap operation needs it; rotate or remove afterward when safe. |

Keys listed in more than one scope must be configured in each runtime that consumes them.
`AI_RUNTIME_SECRET` and `PAYMENT_MUTATION_SECRET` must match between Next.js and the corresponding
Convex deployment. URL values must include `http://` or `https://` and must identify the actual
preview or production frontend origin. `NODE_ENV`, `VERCEL_ENV`, and local `CONVEX_DEPLOYMENT` are
normally supplied by the platform or Convex CLI rather than entered by hand.

Before activation, compare the key names in the manifest with Vercel Preview, Vercel Production,
the Convex preview defaults, and the Convex production deployment. Compare names and presence only;
do not paste values into logs or tickets.

## Local and hosted quality gates

`.github/workflows/hosted-quality.yml` runs a credential-free, target-neutral subset on pull
requests and `main`. Its third-party actions are commit-pinned, its permissions are read-only, and
concurrency cancels superseded runs. It never runs Convex codegen/deploy, Vercel operations,
authenticated browser tests, migrations, or provider commands. Branch-rule status is an external
setting and remains unverified; do not call this check required until GitHub protection is inspected.

The hosted lane complements rather than replaces the complete local gate because a clean clone has
no generated Convex API surface or authenticated non-production sessions. It records its exact Git
revision and scope in the job summary.

Before merging or deploying, run `bun run verify:local`. It runs the target-neutral local gates in
order, stops on the first failure, and labels its local-only evidence with the current commit and
timestamp. Run environment preflight, a fresh Convex codegen, the configured Next build,
deployment, and browser proof separately after identifying the exact target; a green local verifier
is not deployment or production proof.

`verify:local` includes the public asset/runtime check, authenticated Staff Workspace performance
budget check, and high-risk coverage ratchet through `bun run check`. The performance check
validates all declared scenarios and both baseline source hashes;
it does not replace credentialed Playwright or production browser proof. Follow
[`docs/STAFF_WORKSPACE_PERFORMANCE.md`](docs/STAFF_WORKSPACE_PERFORMANCE.md) when a monitored read
or route lifecycle changes, and
[`docs/PUBLIC_RUNTIME_PERFORMANCE.md`](docs/PUBLIC_RUNTIME_PERFORMANCE.md) when a monitored public
route or hero-media policy changes.

Optional local feedback-loop evidence can be retained without telemetry:

```bash
bun run verify:local -- --metrics .scratch/dx-metrics/verify.json
```

For typed release-scope evidence, use `bun run verify:local -- --evidence auto`. The resulting
ignored JSON records the exact clean revision or dirty fingerprint, every local gate result, and
explicit `not_run` rows for push, deployment, migration, and public/authenticated smoke scopes. Its
human summary is generated from the same JSON; it is not a deployment record.

The JSON includes schema version, dirty revision fingerprint, gate IDs, monotonic durations,
outcomes, and the first failure/skipped reason. It never includes command output, environment
values, customer data, machine identity, or an upload destination. Measure several representative
runs before proposing any duration budget; do not skip, reorder, or parallelize gates to improve a
number.

Reproduce the Studio lane locally with
`cd citius-blog && bun install --frozen-lockfile && bun run build && bun audit --audit-level=high`.
The Sanity CLI itself runs under Node because Studio 6 requires Node 22.12 or newer; Bun remains the
package manager. See
[`docs/adr/0011-secure-the-standalone-sanity-studio.md`](docs/adr/0011-secure-the-standalone-sanity-studio.md).

The lint baseline is explicit in `config/release/lint-baseline.json`. Generated Convex surfaces are
excluded by `biome.json`. A rule family may be burned down and then recorded with
`bun run lint:ratchet:update`; the update command refuses to write while any family has increased.
Use `bun run lint:ratchet -- --family=lint/performance` to focus the reduction report without
weakening the repository-wide comparison.

The report-only dead-code inventory is pinned by `knip.jsonc` and
`config/release/deadcode-baseline.json`. Run `bun run deadcode` to triage and
`bun run deadcode:ratchet` to reject new findings. The update command can only
initialize or shrink the reviewed allowlist; Knip output is never deletion
authority. See `docs/DEAD_CODE_INVENTORY.md`.

First-party TypeScript commands expose `--help` without reading targets, starting
services, running audits, or writing evidence. `bun run help` derives the package
command inventory from `package.json`. Environment preflight requires an
explicit `--target preview|production`; help/list discovery never infers one.

Run `bun run diff:check` before committing a migration bundle. The atomic replacement manifest
lists entrypoints that may be deleted only when an allowed successor is present in the same
candidate change. The local command evaluates tracked, staged, and untracked state so the complete
working tree can be checked before staging.

To reproduce the committed-range check locally, provide an explicit base commit:
`DIFF_BASE=<base-sha> bun run diff:check`. Never infer a deployment or release base from an
unrelated local branch.

For a richer advisory review-load report, use
`bun run release:scope -- --base <base-sha>`. It reports commit typing, files/raw lines, ownership,
test ratio, renames/binaries, recent hotspots, tool/product mixing, and path-explained risk tags.
Its suggested commands remain target-neutral; the report reads Git metadata only and never reads
file contents, environment values, or deployment state.

For schema/data work, validate the target-explicit planning manifest with
`bun run migration:rehearsal -- --manifest <path>`. The planner only prints
blocked command templates; it has no execution mode and never reads a target or
secret. The protected snapshot lifecycle, exact Convex Preview/import flags,
content-free evidence contract, restore-loss warning, and Production authority
gate are defined in
[`docs/migrations/rehearsal.md`](docs/migrations/rehearsal.md).

`convex/crons.test.ts` is the local source proof for exactly nine unique internal registrations:
four daily UTC cron expressions and five intervals, all with `{}` arguments. Its IST calendar
assertions prove the 31 March leave-lapse boundary. This does not prove the schedule is installed;
after an authorized deployment, separately confirm names, targets, and schedules in the named
Convex deployment dashboard.

## Agent-tool integration units

Broad synchronization under `.agents/skills/` or `.claude/skills/` should land
in a dedicated buildable, revertible commit or pull request, separate from
changes under `src/`, `convex/`, application configuration, or domain docs.
Generated/vendor-like bulk and hand-authored runtime files should be named
separately in the change description.

Path separation is advisory, not permission to split an atomic replacement into
broken commits. If a product change directly requires a hook or agent-tool
change, keep the unit buildable and add an **explicit coupling note** naming the
dependency and why separate reversion would be unsafe. Inspect the exact range
with `DIFF_BASE=<base-sha> bun run diff:check`; this local report never implies
publication or deployment.

## Preview and production deployment

The protected Vercel build command in `vercel.json` is:

```bash
bunx convex deploy --cmd 'bun run build'
```

The same command selects its target through `CONVEX_DEPLOY_KEY`:

- Vercel **Production** gets a production deploy key scoped only to Production and granted
  `deployment:deploy`—not data, log, or environment-management access.
- Vercel **Preview** gets a project preview deploy key scoped only to Preview. Convex creates or
  reuses the branch preview deployment, whose data, functions, crons, and configuration are separate
  from production.
- Never expose either key to the browser, commit it, or share the production key with Preview.

This follows Convex's current [Vercel hosting](https://docs.convex.dev/production/hosting/vercel),
[deploy command](https://docs.convex.dev/cli/reference/deploy), and
[deploy-key](https://docs.convex.dev/cli/deploy-key-types) contracts. A Vercel dashboard build-command
override can supersede repository settings, so confirm the observed command in one Preview build
before production activation.

## Activation checklist

1. Confirm the current release commit and retain the previous known-good commit identifier.
2. Confirm backup/restore readiness and use widen-migrate-narrow for stored-value/schema changes.
3. Run `bun run verify:local -- --evidence auto` for the exact candidate revision. Treat
   [`docs/WORKING_TREE_CHANGES.md`](docs/WORKING_TREE_CHANGES.md) only as dated historical context.
4. Configure manifest keys independently for Preview and Production; verify auth callback origins,
   mail sender/domain, payment webhooks, CAPTCHA, and Convex runtime values.
5. Run and inspect a Vercel Preview. Verify its frontend points to the preview Convex deployment and
   that it does not contain production data.
6. Run any reviewed one-time migration against the intended deployment explicitly. Never infer the
   target from a local shell session.
7. Promote only after local quality gates, signed-in workflow checks, and preview smoke tests are green.
8. After production activation, verify auth, one read/write CRM smoke path, mail, payment webhook
   health, AI terminal states, logs, and scheduled jobs without using destructive test data.

## Rollback

1. Stop further promotion and record the failing frontend and Convex deployment identifiers.
2. Roll the frontend back to the previous known-good Vercel deployment or redeploy that commit.
3. From the same known-good commit, run the protected Convex-aware command with the production key
   only after reviewing schema compatibility. Redeploying code does not undo data migrations.
4. For bad data, prefer a reviewed forward repair. Restore a backup only with explicit production
   authority and a tested restore plan.
5. Restore or rotate environment values separately when configuration caused the incident.
6. Repeat the production smoke checks and document the incident before reactivation.

If a third-party action is consuming quota uncontrollably, Convex can be paused from the dashboard,
but pausing rejects new function calls and skips crons; use it only as an explicit incident decision,
not as the normal rollback path.

## Live settings still unknown

Until separately inspected, the repository does not confirm Vercel environment presence or
dashboard overrides, Convex key scope and preview defaults, backup schedules, GitHub branch rules,
custom-domain/auth callback settings, webhook endpoints, or provider-side activation. These are
manual/external release steps, not evidence gaps that local code can truthfully close.
