# Staff Workspace

Citius staff sign in to Citius Connect and work in role-scoped portal views (Queries, Proposals, Job
Cards, Tickets, Finance, HR leave, Settings). Anonymous visitors to `/portal` are sent to sign in.

## Sub-features

- `staff-gate` anonymous `/portal` settles on `/auth/connect` in a browser.
- `staff-sign-in` the sign-in page renders "Citius Connect" with textbox "Email Address", textbox
  "Password", link "Forgot password?", button "Sign in", button "Continue with Google".
- `staff-role-routes` each seeded role reaches its home view (smoke cases `admin-dashboard`,
  `sales-pipeline`, `contracting-proposals`, `operations-travellers`, `ticketing-list`,
  `finance-approvals`, `hr-leave`, …).
- `staff-interactions` modal create/edit/delete and Query → Job Card handoffs (Playwright `@critical`,
  `@workflow`).

## How to get to it (user POV)

- Open `/portal` or `/auth/connect`. Staff use **Forgot password** to set a password; there is no
  staff sign-up.

## Driving it with agent-browser and Playwright

Preconditions:

- Doctor exits 0.
- Signed-in steps only: an approved, seeded, non-production target (below).

- **Gate.** `agent-browser open $BROWSER_SMOKE_BASE_URL/portal`, `agent-browser wait --load networkidle`,
  `agent-browser get url` → `/auth/connect`. curl shows 200 because the gate is client-side; only the
  browser result counts.
- **Sign-in page.** `bun scripts/browser-smoke.ts --profiles public --cases staff-sign-in --strict` reads
  `passed  staff-sign-in`; `agent-browser snapshot -i` lists the handles above.
- **Role routes (signed in).** Sign each seeded profile into its own agent-browser session, export
  `BROWSER_SMOKE_<ROLE>_SESSION`, then `bun run smoke:browser:authenticated`. Any skip fails it.
- **Interactions (signed in).** `bun run test:e2e:critical` / `test:e2e:workflow`.
- **Proof.** `evidence/portal-unauth.aria.txt` + screenshot for the gate; Playwright evidence reporter
  output for signed-in lanes.

## Seeded target (needed for every signed-in step)

Follow `docs/E2E_TESTING.md` exactly; in short: an isolated loopback Convex backend
(`E2E_CONVEX_DEPLOYMENT=local` or `CONVEX_SELF_HOSTED_URL`) with no provider keys and no real data;
`E2E_SEED_SECRET`, `E2E_STAFF_PASSWORD`, `E2E_PROVISIONING_TARGET=development`,
`E2E_TARGET_ID=development-local*` set on both that backend and the E2E shell (not the plain dev
shell: `dev:doctor` rejects them there); `.scratch/e2e/approved-targets.json` binding frontend origin,
Convex site origin, exact clean revision, and Convex source hash. Global setup seeds the
`e2e-*@citius-e2e.test` profiles, signs them in, and teardown removes run-owned records. Seeding is a
database write on that target: name the target before doing it.

## Gotchas

- Never seed or sign in against the owner's shared `dev:` deployment, and never with real staff
  accounts; Production is rejected by the harness and must not be attempted.
- Running `convex dev`/`dev:all` from a worktree pushes functions to the shared dev deployment.
- Strict lanes need a clean checkout matching `E2E_TARGET_REVISION`; uncommitted edits fail preflight.
