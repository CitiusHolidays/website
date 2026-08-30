# Repository contract

Read `CONTEXT-MAP.md`, the relevant glossary, and the matching branch in
`docs/agents/task-routing.md` before changing behavior. The router preserves the
settled rules without loading an implementation-history cache into every task.

## Global boundaries

- Preserve the Staff Workspace and Customer Account as distinct visual,
  behavioral, and authorization baselines. Shared internals do not authorize a
  redesign or convergence.
- Keep local checks, publication, preview/production deployment, migrations,
  database writes, and authenticated live proof as separate evidence states.
  Identify the exact target before target-bound work and obtain fresh explicit
  authority for Production or another high-impact external action.
- GitHub Issues are the canonical ticket/spec record. Local `.scratch/`
  artifacts are implementation evidence and handoffs. Use `docs/PLAN_MAP.md` for
  historical pointers; do not recreate a second plan system.
- Preserve unrelated working-tree changes. A document, generated output, or
  passing build is not authority to overwrite user work or mutate an external
  system.
- When prose and executable policy disagree, report the conflict and resolve it
  at the owning source with focused tests. Do not silently choose the broader
  permission, mutation, or migration behavior.
- Use `DESIGN.md` for UI ownership and `docs/VERIFICATION.md` for command/proof
  vocabulary. Shared foundations never authorize cross-surface convergence.

## Task routing

Use the trigger matrix and root-rule trace in
`docs/agents/task-routing.md`. It routes auth, Convex, Next.js, commercial and
leave workflows, portal UI/motion, spreadsheets, roles/access, release/deploy,
public-site work, TypeScript/Effect, and issue-tracker tasks to their durable
owners.

## Health Stack

`package.json` owns the repository commands. Run `bun run help` for the reviewed task-first
catalogue, including each command's profile, effects, and proof boundary. Use the relevant focused
package script during implementation and `bun run verify:local` for complete target-neutral local
evidence. Dead-code review remains `bun run deadcode` followed by `bun run deadcode:ratchet`.

`bun run typecheck` refreshes ignored Next route types before TypeScript. For an
assessment-only pass, `bun node_modules/@typescript/native/bin/tsc --noEmit
--project tsconfig.json` avoids that generation but cannot prove current Next
route types. These checks do not
replace deployment, migration, environment, or live proof in `RELEASE.md`.

## Agent references

GitHub Issues own issues and specs. See `docs/agents/issue-tracker.md` and
`docs/agents/triage-labels.md`. This repository has multiple bounded contexts;
start at `CONTEXT-MAP.md`, then use the relevant glossary and ADRs. See
`docs/agents/domain.md`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
