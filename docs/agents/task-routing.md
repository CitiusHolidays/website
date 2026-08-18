# Task-triggered repository routing

Read only the branches that match the task, plus `CONTEXT.md`. Executable policy
and focused tests outrank prose when they disagree; record the disagreement
instead of silently choosing a behavior change.

| Task trigger | Authoritative destination |
| --- | --- |
| Domain names, Staff Workspace vs Customer Account boundaries, Travel Batch language, Sacred Bharat concepts | `CONTEXT.md`, relevant ADRs under `docs/adr/`, and `docs/agents/domain.md` |
| Convex schema, API, query, mutation, action, cron, authz, migration, or data work | Generated Convex block in `AGENTS.md`, `convex/_generated/ai/guidelines.md`, the matching local `convex-*` skill, `docs/BACKEND_INFRASTRUCTURE.md`, and relevant ADRs |
| Next.js route, rendering, caching, runtime, or build work | Generated Next.js block in `AGENTS.md`, the relevant installed guide under `node_modules/next/dist/docs/`, and `docs/CACHE_COMPONENTS.md` when caching is involved |
| Staff commercial, Query, Proposal, Job Card, leave, notification, expense, file, list, date, dashboard, or portal-chrome workflow | `docs/PORTAL_CRM_WORKFLOWS.md` |
| Role, permission, picker, assignment, Cement scope, or sensitive-record access | Executable server/client role policy and parity tests first, then `docs/PORTAL_ROLES_AND_ACCESS.md` and `docs/PORTAL_PERMISSIONS_ARCHITECTURE.md` |
| Spreadsheet import, export, passenger, traveller, passport, visa, ticketing, rooming, or Travel Batch work | Spreadsheet sections in `docs/PORTAL_CRM_WORKFLOWS.md`, `docs/STAFF_WORKSPACE_PERFORMANCE.md`, and the relevant import/export ADR or migration note |
| Portal UI, motion, overlay, command palette, table, modal, or layout work | `CONTEXT.md`, `docs/PORTAL_CRM_WORKFLOWS.md`, `docs/TRANSITION_POLICY.md`, and the installed frontend/motion skill required by the task |
| Authentication, password reset, account linking, origin, session, or privileged-auth work | `docs/BACKEND_INFRASTRUCTURE.md`, `docs/LOCAL_DEV.md`, `docs/AUTH_DOMAIN_CUTOVER.md`, and relevant security/identity ADRs |
| TypeScript migration or proposed Effect usage | `docs/adr/0004-typescript-first-effect-adoption.md` and direct behavior tests for each retained seam |
| Public website, Concierge, contact, policy, MICE, pilgrimage, or visual-identity work | `CONTEXT.md`, the relevant public design/brand document, and focused behavior or mounted tests |
| Release, deploy, environment, Vercel, Convex target, E2E, browser proof, or rollback work | `RELEASE.md`, `config/environment.manifest.json`, `docs/LOCAL_DEV.md`, `docs/E2E_TESTING.md`, and `docs/BROWSER_SMOKE.md` |
| Issue, ticket, Wayfinder map, or planning-evidence work | `docs/agents/issue-tracker.md` and `docs/PLAN_MAP.md`; GitHub is canonical and `.scratch/` is local evidence |
| Repository health, lint, dead code, hooks, or command discovery | `AGENTS.md`, `package.json`, `docs/DEAD_CODE_INVENTORY.md`, and `docs/LOCAL_DEV.md` |

## Root-rule trace

This table records where the former root instruction cache moved. It is a
reachability map, not a second domain manual.

| Former root rule family | Single durable owner |
| --- | --- |
| Commercial semantics, Proposal Doc language, Job Card numbering, portal behavior, dates, notifications, leave, imports and room labels | `docs/PORTAL_CRM_WORKFLOWS.md` |
| Staff provisioning, Forgot password, auth linking and URL restart behavior | `docs/BACKEND_INFRASTRUCTURE.md` |
| Role permission data and record scope | Executable role policy plus `docs/PORTAL_ROLES_AND_ACCESS.md` |
| TypeScript-first and Effect thresholds | ADR 0004 |
| Staff/Account visual and authorization separation | `CONTEXT.md` |
| Motion and reduced-motion behavior | `docs/TRANSITION_POLICY.md` |
| Sacred Bharat terminology and boundaries | `CONTEXT.md` plus `docs/SACRED_BHARAT_IDENTITY_KIT.md` |
| Release commands, evidence vocabulary, targets, migrations and rollback | `RELEASE.md` |
| Historical planning and implementation evidence | `docs/PLAN_MAP.md` and `docs/agents/issue-tracker.md` |

Do not infer a behavior change from this routing layer. If a routed prose claim
conflicts with current executable policy or a user instruction, stop that slice,
surface the exact conflict, and resolve it at the owning source with tests.
