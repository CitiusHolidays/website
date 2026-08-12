<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

Read `CONTEXT-MAP.md`, the relevant glossary, and the matching trigger branch in
`docs/agents/task-routing.md` before changing behavior. Root `AGENTS.md` owns the
global evidence, authorization, preservation, and issue-source boundaries.

## Health Stack

`package.json` is the executable command owner:

- App/source types: `bun run typecheck`
- Convex types: `bun run convex:typecheck`
- Lint and no-regression baseline: `bun run lint` then `bun run lint:ratchet`
- Tests: `bun run test`
- Framework-aware dead code: `bun run deadcode` and `bun run deadcode:ratchet`
- Complete target-neutral release evidence: `bun run verify:local`

`bun run typecheck` refreshes ignored Next route types before TypeScript. For a
strictly assessment-only pass, `bunx tsc --noEmit --project tsconfig.json` avoids
that generation but cannot prove current Next route types. The Health Stack does
not replace the deployment, migration, environment, or live-proof procedures in
`RELEASE.md`.

## Agent skills

### Issue tracker

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The default triage vocabulary is used. See `docs/agents/triage-labels.md`.

### Domain docs

This is a multi-context repository. Start at `CONTEXT-MAP.md`, then read the
relevant glossary and ADRs. See `docs/agents/domain.md`.
