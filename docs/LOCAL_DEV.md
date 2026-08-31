# Local development

## Quick start

1. Copy environment variables from your team vault into `.env.local` (Convex URL, Better Auth secrets, `SITE_URL` with `http://` scheme).
2. Use the Bun version in `package.json#packageManager` and a compatible Node version from `package.json#engines`.
3. Install dependencies: `bun install --frozen-lockfile`.
4. Run the profile doctor: `bun run dev:doctor -- --profile public|portal|studio|full`.
5. Run the command printed for the selected profile:
   - `public` → `bun run dev`
   - `portal` → `bun run dev:all`
   - `studio` → `bun run --cwd citius-blog dev`
   - `full` → start both `bun run dev:all` and `bun run --cwd citius-blog dev` in separate terminals
6. Open the site at `http://localhost:3000` and the portal at `/auth/connect`.

`dev:all` uses `convex dev --start` as the single supervisor: Convex completes its initial development push, then starts Node-hosted `next dev --turbopack`. `bun run dev` starts Next.js alone; `bun run dev:webpack` is the explicit webpack fallback.

The doctor is side-effect-free. Portal/full profiles require an explicit `dev:`
Convex target and generated API files. Every profile rejects deployment keys,
Production platform state, and E2E provisioning settings; remove those settings
from the ordinary local shell and use the separately approved target-bound
workflow when needed.

Run `bun run help -- --tasks` for the task-first catalogue. It names the profile, effects, and proof
boundary for every reviewed entry before the command is run.

## Common commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Next.js only (assumes Convex already running) |
| `bun run dev:inspect` | Next.js with local-only React Grab and React Scan inspection enabled |
| `bun run dev:doctor -- --profile <name>` | No-network local readiness and target-safety check |
| `bun run convex:dev` | Convex backend watcher |
| `bun run check` | Lint ratchet + full test suite |
| `bun run check:fast` | Tests only (skip lint) |
| `bun run typecheck` | App TypeScript |
| `bun run convex:typecheck` | Convex TypeScript |
| `bun run doctor -- --verbose --scope changed --include-untracked --no-score` | Pinned local React diagnostics for changed React source |
| `bun run deadcode` / `bun run deadcode:ratchet` | Report and enforce the reviewed dead-code inventory |
| `bun run help` | Side-effect-free package command inventory |
| `bun run repo:orient` | Source-derived revision and owner orientation; no release claim |
| `bun run docs:check` | Fail-closed ownership-critical documentation contracts |
| `bun run spec:check -- <exact-spec.md>` | Validate one local handoff without network or writes |
| `bun run spec:render-issue -- <exact-spec.md>` | Render one authorized spec to stdout; never publish it |
| `bunx convex codegen` | Regenerate `_generated` after schema/API changes |
| `bun run performance:check` | Public asset and authenticated Staff Workspace budgets |
| `bun run verify:local` | Required local/CI parity gate: lint, both typechecks, all tests, and coverage |

## Local React inspection

Run `bun run dev:inspect` when Next.js can run without starting Convex, or run
`CITIUS_REACT_INSPECTION=1 bun run dev:all` when the selected local profile needs the Convex
development supervisor. Restart Next.js when changing the flag because the tool modules are chosen
when Next reads its configuration.

React Grab lets you select a rendered element and copy its component/source context. React Scan
shows local rerender outlines and its inspection toolbar. React Grab's anonymous version-check
request is disabled in the Citius integration. Neither tool stores annotations or sends Citius
records to the backend.

`doctor.config.json` keeps the full scan focused on actionable React behavior. It excludes generic
loop and await advice for ordered Convex transactions and release tools, preserves manual callback
identity where event, motion, and imperative APIs depend on it, and records narrow false-positive
exceptions for composed labels, response handling, and object-URL cleanup that focused tests prove.

Keep `CITIUS_REACT_INSPECTION` out of `.env.local`; the opt-in should be visible in the command that
started the development session. The default `bun run dev` path is unchanged. Non-development
builds exclude the instrumentation module even if the flag is present, and the official public and
Staff Workspace performance workflows accept only non-development build or deployed output where
the shared gate resolves to no modules. Stop the inspection server before collecting performance
evidence. Use the [interface review contract](INTERFACE_REVIEW.md) for the owning surface checklist
and proof boundary.

## Auth and env notes

- Restart Next.js fully after auth env changes (`SITE_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`); hot reload does not reload auth module URLs.
- Staff sign in via **Forgot password** on `/auth/connect`, not sign-up.
- Cloud agents may set `CONVEX_AGENT_MODE=anonymous` when running `npx convex dev` to avoid conflicting with your personal deployment.

## Verification before push

```bash
bun run check:fast path/to/changed.test.ts   # focused tests
bun run check                                 # lint + tests before merge
```

For an authenticated route change in Queries, Proposals, Job Cards, Contracting, Finance, Tickets,
Hotels / Rooming, or Visa Tracking, run the focused performance spec after completing the E2E seed
setup and binding both non-production runtimes to the same exact revision:

```bash
bunx playwright test e2e/specs/staff-workspace-performance.spec.ts
```

After Convex schema or function signature changes, run `bunx convex codegen` (or keep `convex dev` running).

## Pre-commit hook

`bun install --frozen-lockfile` prepares the tracked Husky hook. It remains fast
and staged-only: `git diff --cached --check`, then `lint-staged`. Root JS/TS/JSON/CSS
files use check-only Ultracite/Biome; `citius-blog` sources use that workspace's
pinned Prettier with `--check`. Documentation-only, binary-only, deletion, and
empty commits do not trigger a full test, typecheck, build, or source rewrite.
