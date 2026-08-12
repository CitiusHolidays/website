# Playwright CRM interaction tests (hybrid harness)

Citius Connect uses a **hybrid** browser test stack: `agent-browser` navigation smoke (`bun run smoke:browser`) checks that routes render for each role without clicking forms, while **Playwright** (`bun run test:e2e`) owns modal open/save/delete flows and multi-step Query → Job Card handoffs. Playwright does not replace `bun run test` contract suites or Convex policy unit tests.

Strict commands are authenticated evidence commands and fail before browser launch when credentials,
seed inputs, target classification, or the explicit frontend URL are unsafe. `test:e2e:optional` is
the skip-friendly discovery command and cannot be cited as authenticated proof. No Production E2E
provisioning is allowed.

## Commands

| Command | What it runs |
|---------|----------------|
| `bun run test` | Unit + contract tests (Playwright specs excluded) |
| `bun run test:local` | Target-neutral tests, then strict authenticated Playwright |
| `bun run test:e2e` | All Playwright specs in strict mode |
| `bun run test:e2e:optional` | Skip-friendly discovery; never authenticated proof |
| `bun run test:e2e:critical` | `@critical` tag only |
| `bun run test:e2e:smoke` | `@smoke` tag only |
| `bun run test:e2e:workflow` | `@workflow` tag only |
| `bun run test:e2e:cleanup -- --run-id <uuid>` | Resume bounded cleanup for one interrupted non-production run |
| `E2E_STRICT=1 bunx playwright test e2e/specs/staff-workspace-performance.spec.ts` | Strict authenticated cold/warm Staff Workspace budgets |
| `bun run performance:staff:collect` | Strict revision-bound Staff performance evidence bundle |
| `bun run smoke:browser:public` | Strict credential-free public navigation smoke |
| `bun run smoke:browser:authenticated` | Strict session-backed Staff smoke; any selected skip fails |
| `bun run smoke:browser` | Optional all-case discovery, including record-URL cases |
| `bun run browser:evidence:preview-public -- --base-url https://... --target-id preview-...` | Revision-bound credential-free Preview public evidence |

Tags: `@critical`, `@smoke`, `@workflow`, `@performance`.

`@mobile-quality` runs all eleven seeded Staff profiles at 390x844, checks the role route, horizontal
overflow, mobile navigation focus restoration, account-menu focus restoration, and the Sales Query
primary/More action contract. A missing disposable Sales Query is reported as a product-precondition
skip rather than silently counted as executed action proof.

## Local setup

1. Start app + Convex dev (`bun run dev:all`).
2. Add to the selected **development Convex deployment** and **`.env.local`**:

   | Variable | Where | Value |
   |----------|--------|--------|
   | `E2E_SEED_SECRET` | Convex + `.env.local` | Any long random string you choose |
   | `E2E_STAFF_PASSWORD` | Convex + `.env.local` | Shared test password (min 8 chars) |
   | `E2E_PROVISIONING_TARGET` | Convex + `.env.local` | `development` locally; `preview` only for an isolated Preview |
   | `E2E_TARGET_ID` | Convex + `.env.local` | Exact `development-*` or `preview-*` identity approved below `.scratch/e2e` |
   | `E2E_TARGET_MANIFEST` | Local shell only | Optional path below `.scratch/e2e`; defaults to `.scratch/e2e/approved-targets.json` |
   | `NEXT_PUBLIC_CONVEX_SITE_URL` | `.env.local` | Site URL for that same non-production Convex deployment |
   | `BROWSER_SMOKE_BASE_URL` | `.env.local` | Loopback URL for development; explicit non-loopback HTTPS URL for Preview |

3. Create `.scratch/e2e/approved-targets.json` with the exact frontend/Convex origin pair. This
   ignored, locally reviewed manifest is mandatory for every authenticated or Preview-evidence run:

   ```json
   {
     "schemaVersion": 1,
     "targets": [
       {
         "convexSiteOrigin": "http://localhost:3210",
         "frontendOrigin": "http://localhost:3000",
         "id": "development-local",
         "target": "development"
       }
     ]
   }
   ```

4. Run tests. Global setup validates every prerequisite, compares both configured origins with the
   approved manifest, independently reads `/api/e2e/identity` from the frontend, calls the protected
   seed endpoint with the same server-configured target ID, and
   aborts on any seed or sign-in failure before specs execute:

   ```bash
   bun run test:local
   # or just interaction layer:
   bun run test:e2e:critical
   ```

Staff emails are in `config/e2e-staff-profiles.json` (`e2e-{role}@citius-e2e.test`). Passwords are never committed.

`E2E_PROVISIONING_TARGET=production`, `VERCEL_ENV=production`, an ambiguous target, a non-loopback
development frontend/Convex site, a loopback/non-HTTPS Preview origin, or any manifest/runtime
identity mismatch is rejected before `.auth` is
created. The Convex seed action independently rejects Production at the backend boundary. The
default worker count is one because profiles share a single isolated non-production fixture set.

## Auth storage

`e2e/global-setup.ts` signs each profile in through `/auth/connect` and writes `e2e/.auth/{role}.json` (gitignored). Specs load these via Playwright `storageState`.

## Matrix

`e2e/registry/portalViews.ts` lists every portal view ID and exact covered role/action cells.
Remaining cells emit explicitly categorized planned-matrix `@smoke` stubs. The evidence reporter
writes passed/failed/skipped totals, exact matrix coverage (currently 9/25 views, 13/15 distinct
actions, 10/10 planned roles, and 19/42 exact role/action/view cells), plus missing-credential,
missing-record-URL,
product-precondition, and planned-matrix skip counts to the ignored Playwright result directory.

The strict workflow lane also provisions deterministic, idempotent non-production fixtures for a
distinct leave head, Cement-scoped roles, and an incomplete Proposal. It proves head approval before
HR final approval, exclusion of a non-Cement Query from Sales Cement, and rejection of Send to Sales
until pricing is complete. These fixtures are forbidden in Production by the shared E2E guard.

| View | Spec |
|------|------|
| `queries`, `proposals` | `e2e/specs/critical-path.spec.ts` |
| `accounts-job-cards`, `travellers` | `e2e/specs/critical-path.spec.ts` |
| `tickets` | `e2e/specs/ticketing-row-edit.spec.ts` |
| `expenses` | `e2e/specs/finance-expense.spec.ts` |
| `employees-on-leave` | `e2e/specs/hr-leave.spec.ts` |
| `settings` | `e2e/specs/admin-settings.spec.ts` |
| `passport` | `e2e/specs/passport-modal.spec.ts` |

The `@performance` spec covers Dashboard to All Sales Queries, Proposals, and Job Cards for Sales,
Contracting, and Operations. Each scenario records cold navigation and a warm navigation after its
tracked preload. The six budgeted metrics are application payload bytes, duplicate subscriptions,
first-content time, logical subscriptions, route-ready time, and route-resource transfer bytes. It
records only privacy-safe subscription names and aggregate numbers, attaches per-scenario JSON to
the Playwright result, and checks the limits in
`config/release/staff-workspace-performance-budgets.json`; it does not persist record IDs or
provider payloads. See [`docs/STAFF_WORKSPACE_PERFORMANCE.md`](STAFF_WORKSPACE_PERFORMANCE.md) for
the baseline, dependency-closure freshness rule, and replacement review procedure. Replacing the
baseline requires a fresh strict authenticated run, exact revision/fingerprint, privacy review,
source-closure review, and written budget justification.

`performance:staff:collect` validates the non-production target before launching a browser, binds
all six samples to the exact clean revision or dirty-content fingerprint, rejects missing/malformed
scenarios, and writes only aggregate JSON below the ignored Staff performance evidence directory.
It does not replace the checked-in baseline automatically.

`@workflow` delete specs use a Convex developer-authenticated inline query for the traveller
assertion. The old public `crm/e2eAssertions:travellerExists` oracle is now an internal helper and
is not callable by browser clients. The staff/auth seed is an HTTP action protected by the
`x-e2e-seed-secret` header. `E2E_SEED_SECRET` is never placed in a process argument or assertion
payload.

Each strict authenticated run creates a UUID ownership record before its workflow fixtures or browser
mutations. Inserts made by authenticated E2E identities are atomically recorded in
`e2eOwnedRecords`; reusable fixture patches retain their original values in `e2eMutatedRecords`;
names and timestamp prefixes are never delete authority. Global teardown removes only explicit IDs
using a reviewed dependency-order table, restores snapshots, deletes owned storage references, and
fails unless the durable residual count reaches zero. Cleanup is
idempotent. If a process is interrupted, resume it with the non-secret run UUID and
`test:e2e:cleanup`; the UUID is recorded at `.scratch/e2e/active-run.json`. The same server guard
rejects Production and unclassified targets.
Workflow bell rows remain part of the real transaction and are ledger-owned; provider email
scheduling is suppressed only while an authenticated E2E run is active, so browser evidence cannot
send external mail or leave asynchronous delivery-ledger rows.

Reusable staff accounts and deterministic workflow fixtures are target fixtures, not run-owned
records. Seed setup restores their documented preconditions before activating a run. A dedicated
non-production target must deploy the ownership schema/functions before executing this lane;
source tests alone are not cleanup-rehearsal evidence.

## Failure artifacts

Playwright retains trace, screenshot, and video on failure under `.scratch/playwright-results`. Logs should be redacted before sharing (see `e2e/fixtures/redact.ts`).

## Future hosted authenticated lane

The current `Hosted Quality` workflow is credential-free and intentionally does not run
Playwright. A later authorized authenticated lane needs an isolated non-production deployment,
serialized fixture ownership, `E2E_STAFF_PASSWORD`, `E2E_SEED_SECRET`,
`E2E_PROVISIONING_TARGET=preview`, `NEXT_PUBLIC_CONVEX_SITE_URL`, and the implemented
`BROWSER_SMOKE_BASE_URL`. It must preserve strict preflight, never seed Production, and record its
exact revision/target separately from local and Production evidence. No tracked instruction uses an
unsupported alternate E2E base-URL variable.

The Preview public adapter is separate from `verify:local`, requires an explicit non-production
target ID and non-loopback HTTPS URL, runs no seed/auth setup, and records only the
`preview-public-smoke` release-evidence scope. Production is deliberately not a supported target.

## Related docs

- `docs/BROWSER_SMOKE.md` — navigation-only smoke
- `docs/adr/0005-playwright-crm-interaction-tests.md` — harness decision
