# Release operations

This file is the repository-owned release contract. It records commands and expected scopes; it
does not assert that Vercel, GitHub, Convex, DNS, or provider dashboards are already configured.

The complete local change summary and latest evidence snapshot are in
[`docs/WORKING_TREE_CHANGES.md`](docs/WORKING_TREE_CHANGES.md). As of 14 July 2026, the local release
gates passed with 625 tests, application and Convex typechecks, a 17-error / 1,664-warning lint
ratchet result below baseline, configuration and diff checks, React Doctor 100/100, and a successful
84-page production build. These results are local evidence, not proof that external platform
settings or production activation are complete.

## Environment ownership

[`config/environment.manifest.json`](config/environment.manifest.json) is the canonical key-only
manifest. [`.env.example`](.env.example) is the blank local template. Values must never be added to
either file.

| Manifest scope | Where the value belongs |
| --- | --- |
| `browser` | Next.js/Vercel environment. Every key is intentionally browser-visible. Never put a secret in a `NEXT_PUBLIC_*` key. |
| `nextServer` | Next.js server/Vercel environment only. |
| `convexRuntime` | The selected Convex deployment's environment settings. Preview and production are separate. |
| `ciDeploy` | GitHub/Vercel secret or platform/Convex CLI-provided value. |
| `oneTimeOperations` | Convex environment only while the reviewed maintenance/bootstrap operation needs it; rotate or remove afterward when safe. |

Keys listed in more than one scope must be configured in each runtime that consumes them.
`AI_RUNTIME_SECRET` and `PAYMENT_MUTATION_SECRET` must match between Next.js and the corresponding
Convex deployment. URL values must include `http://` or `https://` and must identify the actual
preview or production frontend origin. `NODE_ENV`, `VERCEL_ENV`, and local `CONVEX_DEPLOYMENT` are
normally supplied by the platform or Convex CLI rather than entered by hand.

Before activation, compare the key names in the manifest with Vercel Preview, Vercel Production,
the Convex preview defaults, and the Convex production deployment. Compare names and presence only;
do not paste values into logs or tickets.

## Required CI

`.github/workflows/required-quality.yml` is the required read-only quality workflow. It performs:

1. `bun install --frozen-lockfile`
2. diff hygiene, including atomic JavaScript-to-TypeScript entrypoint replacements
3. all Bun tests, including offline environment and deploy-contract tests
4. Next.js application type checking
5. fresh Convex generation and Convex-project type checking
6. CRM search/metric readiness contracts and cron registration (`docs/CRM_READINESS_OPERATIONS.md`)
7. public asset reference smoke (`bun run assets:check`)
6. a high/critical dependency audit
7. the per-rule lint ratchet

The lint baseline is explicit in `config/release/lint-baseline.json`. Generated Convex surfaces are
excluded by `biome.json`. A rule family may be burned down and then recorded with
`bun run lint:ratchet:update`; the update command refuses to write while any family has increased.
Use `bun run lint:ratchet -- --family=lint/performance` to focus the reduction report without
weakening the repository-wide comparison.

Run `bun run diff:check` before committing a migration bundle. The atomic replacement manifest
lists entrypoints that may be deleted only when an allowed successor is present in the same
candidate change. CI evaluates the committed range; the local command evaluates tracked, staged,
and untracked state so the complete working tree can be checked before staging. A passing local
check does not make a partial staged commit safe—the committed range must pass in CI as well.

GitHub must provide a repository secret named `CONVEX_CI_DEPLOY_KEY`; the workflow maps it to the
standard `CONVEX_DEPLOY_KEY` name only for `convex codegen`. Use a dedicated non-production CI
deployment credential with the minimum permissions proven sufficient for generation. Do not reuse
the production deployment key in the quality workflow. Secrets are not sent to untrusted fork pull
requests, so those contributions require a trusted-branch run before merge.

External activation still required: make **Required quality / Locked install and release gates** a
required branch check after the workflow succeeds on the repository, and confirm the GitHub secret
is present. This task does not change branch protection.

## Preview and production deployment

The protected Vercel build command in `vercel.json` is:

```bash
bunx convex deploy --cmd 'bun --bun next build'
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
3. Run the complete local release evidence command set recorded in the current `.scratch` report.
4. Configure manifest keys independently for Preview and Production; verify auth callback origins,
   mail sender/domain, payment webhooks, CAPTCHA, and Convex runtime values.
5. Run and inspect a Vercel Preview. Verify its frontend points to the preview Convex deployment and
   that it does not contain production data.
6. Run any reviewed one-time migration against the intended deployment explicitly. Never infer the
   target from a local shell session.
7. Promote only after required CI, signed-in workflow checks, and preview smoke tests are green.
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
