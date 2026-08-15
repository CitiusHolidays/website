# Local development

## Quick start

1. Copy environment variables from your team vault into `.env.local` (Convex URL, Better Auth secrets, `SITE_URL` with `http://` scheme).
2. Use the reviewed runtime selectors (`.bun-version`, `.node-version`) or a compatible version from `package.json`.
3. Install dependencies: `bun install --frozen-lockfile`.
4. Run the profile doctor: `bun run dev:doctor -- --profile public|portal|studio|full`.
5. Run Convex and Next.js together: `bun run dev:all`.
6. Open the site at `http://localhost:3000` and the portal at `/auth/connect`.

`dev:all` uses `convex dev --start` as the single supervisor: Convex completes its initial development push, then starts Node-hosted `next dev --turbopack`. `bun run dev` starts Next.js alone; `bun run dev:webpack` is the explicit webpack fallback.

The doctor is side-effect-free. Portal/full profiles require an explicit `dev:`
Convex target and generated API files. Every profile rejects deployment keys,
Production platform state, and E2E provisioning settings; remove those settings
from the ordinary local shell and use the separately approved target-bound
workflow when needed.

## Common commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Next.js only (assumes Convex already running) |
| `bun run dev:doctor -- --profile <name>` | No-network local readiness and target-safety check |
| `bun run convex:dev` | Convex backend watcher |
| `bun run check` | Lint ratchet + full test suite |
| `bun run check:fast` | Tests only (skip lint) |
| `bun run typecheck` | App TypeScript |
| `bun run convex:typecheck` | Convex TypeScript |
| `bun run doctor -- --verbose --scope changed --include-untracked --no-score` | Pinned local React diagnostics for changed React source |
| `bun run deadcode` / `bun run deadcode:ratchet` | Report and enforce the reviewed dead-code inventory |
| `bun run help` | Side-effect-free package command inventory |
| `bunx convex codegen` | Regenerate `_generated` after schema/API changes |
| `bun run performance:check` | Public asset and authenticated Staff Workspace budgets |
| `bun run verify:local` | Target-neutral release gate, including performance and audit checks |

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
