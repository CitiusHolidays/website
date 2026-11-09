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

## When to ask and when to act

- Take reversible steps without asking, then show the result: edits on a
  branch, local builds, tests, a local dev server, a pull request. When running
  something would answer a question, run it rather than asking. Do not ask for a
  rubber stamp.
- Verify on a local dev server, not on Vercel previews. Previews sit behind
  Vercel Authentication and cannot sign in to the portal.
- Stop before one-way steps: production data or users, secrets, anything
  published outside the repository, and merging a pull request (a merge to
  `main` deploys to Production). Save questions for those and for product or
  taste calls. Ask one question at a time, with a recommendation.
- An approved one-way step covers that work, including subagents; quote the
  approval to them. Come back only when the step turns out different from what
  was approved.

## Task routing

Use the trigger matrix and root-rule trace in
`docs/agents/task-routing.md`. It routes auth, Convex, Next.js, commercial and
leave workflows, portal UI/motion, spreadsheets, roles/access, release/deploy,
public-site work, TypeScript/Effect, and issue-tracker tasks to their durable
owners.

## Health Stack

`package.json` owns the repository commands:

- App and source types: `bun run typecheck`
- Convex types: `bun run convex:typecheck`
- Lint and baseline: `bun run lint` then `bun run lint:ratchet`
- Tests: `bun run test`
- Dead code: `bun run deadcode` then `bun run deadcode:ratchet`
- React health: `bun run doctor -- --verbose` must report 100/100 with no issues
  before any change is called done, including after merging `main`. Fix true
  positives in the same change. Exceptions are only for verified false positives
  or deliberately ordered integration tests, recorded with evidence in
  `docs/agents/react-doctor-triage.md`.
- Complete target-neutral evidence: `bun run verify:local`

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
