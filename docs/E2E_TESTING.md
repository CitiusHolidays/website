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
| `bun run test:e2e:public-instant` | Credential-free local public discovery, including the current Sacred Bharat tracer; never target proof |
| `bun run test:e2e:cleanup -- --run-id <uuid>` | Resume bounded cleanup for one interrupted non-production run |
| `E2E_STRICT=1 bunx playwright test e2e/specs/staff-workspace-performance.spec.ts` | Strict authenticated cold/warm Staff Workspace budgets |
| `bun run performance:staff:collect` | Strict revision-bound Staff performance evidence bundle |
| `bun run smoke:browser:public` | Strict credential-free public navigation smoke |
| `bun run smoke:browser:authenticated` | Strict session-backed Staff smoke; any selected skip fails |
| `bun run smoke:browser` | Optional all-case discovery, including record-URL cases |
| `bun run browser:evidence:preview-public -- --base-url https://... --target-id preview-...` | Revision-bound credential-free Preview public evidence |

Tags: `@critical`, `@smoke`, `@workflow`, `@performance`.

`@mobile-quality` runs all twelve seeded Staff profiles at 390x844, checks the role route, horizontal
overflow, mobile navigation focus restoration, account-menu focus restoration, and the Sales Query
primary/More action contract. A missing disposable Sales Query is reported as a product-precondition
skip rather than silently counted as executed action proof.

`e2e/public/sacred-bharat-edition.spec.ts` replaces the retired authenticated guest-progress
contract. It completes Edition 001, renders its result, and restarts through the current anonymous
UI. The tracer supplies an anonymous session response and intercepts the edition event endpoint, so
it creates no backend event or Customer Account state. Event validation remains owned by the
bounded route and Convex integration tests.

## Local setup

1. Start app + Convex dev (`bun run dev:all`).
2. Add to the selected **development Convex deployment** and **`.env.local`**:

   | Variable | Where | Value |
   |----------|--------|--------|
   | `E2E_SEED_SECRET` | Convex + `.env.local` | Any long random string you choose |
   | `E2E_STAFF_PASSWORD` | Convex + `.env.local` | Shared test password (min 8 chars) |
   | `E2E_PROVISIONING_TARGET` | Convex + `.env.local` | `development` locally; `preview` only for an isolated Preview |
   | `E2E_TARGET_ID` | Convex + `.env.local` | `development-local*` for loopback, or `preview-<Convex deployment name>-*`, approved below `.scratch/e2e` |
   | `E2E_TARGET_REVISION` | `.env.local` only | Exact local development revision reported by the Next identity endpoint; Vercel Preview proves its side with `VERCEL_GIT_COMMIT_SHA` |
   | `E2E_TARGET_MANIFEST` | Local shell only | Optional path below `.scratch/e2e`; defaults to `.scratch/e2e/approved-targets.json` |
   | `NEXT_PUBLIC_CONVEX_SITE_URL` | `.env.local` | Site URL for that same non-production Convex deployment |
   | `BROWSER_SMOKE_BASE_URL` | `.env.local` | Loopback URL for development; explicit non-loopback HTTPS URL for Preview |

3. Create `.scratch/e2e/approved-targets.json` with the exact frontend/Convex origin pair. This
   ignored, locally reviewed manifest is mandatory for every authenticated or Preview-evidence run:

   ```json
   {
     "schemaVersion": 3,
     "targets": [
       {
         "convexSiteOrigin": "http://localhost:3210",
         "convexSourceHash": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
         "frontendOrigin": "http://localhost:3000",
         "id": "development-local",
         "revision": "0123456789abcdef0123456789abcdef01234567",
         "target": "development"
       }
     ]
   }
   ```

4. Run tests. Global setup validates every prerequisite, compares both configured origins, the
   exact frontend revision, and the code-baked Convex source fingerprint with the approved manifest,
   independently reads `/api/e2e/identity` from the frontend and Convex Preview, calls the protected
   seed endpoint with the same server-configured target ID, and
   aborts on any seed or sign-in failure before specs execute:

   ```bash
   bun run test:local
   # or just interaction layer:
   bun run test:e2e:critical
   ```

Staff emails are in `config/e2e-staff-profiles.json` (`e2e-{role}@citius-e2e.test`). Passwords are never committed.

`E2E_PROVISIONING_TARGET=production`, `VERCEL_ENV=production`, an ambiguous target, a non-loopback
development frontend/Convex site, a loopback/non-HTTPS Preview origin, a dirty/mismatched revision,
or any manifest/runtime identity mismatch is rejected before `.auth` is
created. The Convex seed action independently rejects Production at the backend boundary. The
default worker count is one because profiles share a single isolated non-production fixture set.

## Auth storage

`e2e/global-setup.ts` signs each profile in through `/auth/connect` and writes `e2e/.auth/{role}.json` (gitignored). Specs load these via Playwright `storageState`.

## Matrix

`e2e/registry/portalViews.ts` keeps three states distinct. The discovery inventory retains all 25
portal views and 43 planned role/action/view cells. The representative registered matrix names live
stable tests for 11 views, all 15 planned action classes, all 12 seeded profiles, all six route
families, and 22 exact cells. The remaining 21 cells and 14 views are visible discovery gaps; they
are neither generated skip stubs nor executed proof.

The schema-v2 evidence reporter writes discovery and current-run execution separately. A registered
cell counts as executed only when its exact selected test title passed in that run; filtered,
skipped, failed, and unselected tests contribute zero. Missing credentials, record URLs, product
preconditions, planned-matrix skips, and uncategorized skips remain separate categories in the
ignored Playwright result directory. Strict evidence additionally records the approved target
class, target ID, and exact 40-character revision from the same manifest validated before setup.

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
| `inbound-leads`, `finance`, `tickets` (Head of Ticketing) | `e2e/specs/mobile-portal-quality.spec.ts` |

The `@performance` spec covers Dashboard navigation to All Sales Queries, Proposals, Job Cards,
Contracting, Finance, All Tickets, Hotel / Rooming, and Visa Tracking with least-privilege Staff
roles. Each scenario records cold navigation and a warm navigation after its
tracked preload. The six budgeted metrics are application payload bytes, duplicate subscriptions,
first-content time, logical subscriptions, route-ready time, and route-resource transfer bytes. It
records only privacy-safe subscription names and aggregate numbers, attaches per-scenario JSON to
the Playwright result, and checks the limits in
`config/release/staff-workspace-performance-budgets.json`; it does not persist record IDs or
provider payloads. See [`docs/STAFF_WORKSPACE_PERFORMANCE.md`](STAFF_WORKSPACE_PERFORMANCE.md) for
the baseline, dependency-closure freshness rule, and replacement review procedure. Replacing the
baseline requires a fresh strict authenticated run, exact revision/fingerprint, privacy review,
source-closure review, and written budget justification.

`performance:staff:collect` validates the exact non-production frontend revision and Convex
deployment-source fingerprint binding
before launching a browser, requires a clean checkout matching that deployed revision, binds all
sixteen median and p95 samples from five isolated trials to it, rejects missing/malformed scenarios,
records browser/cache/fixture and prior-baseline provenance, completes a target-wide cleanup audit,
and writes only the six budgeted aggregate metrics below the ignored Staff performance evidence directory.
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

After performance collection, the target audit scans the bounded ownership and mutation ledgers for
every run belonging to the approved target, not only the latest run or stored summary counters. Any
older dangling ledger row, incomplete run, actor, import/export artifact, storage reference, or
synthetic Traveller makes the evidence inadmissible until bounded cleanup reaches zero.

Before the first seed write, the runner requires an ignored approved-target manifest that binds the
frontend origin, Convex site origin, exact frontend revision, code-baked Convex deployment-source
fingerprint, target class, and a target ID containing the Convex deployment name. The local runner
recomputes that fingerprint from the deployable Convex source closure before comparing it with the
protected read-only Convex identity endpoint. Cleanup repeats those checks and refuses to contact a
different configured site or source bundle.

## Failure artifacts

Playwright retains trace, screenshot, and video on failure under `.scratch/playwright-results`. Redact logs before sharing; `scripts/browser-smoke.ts` owns the browser-smoke redaction rules.

## Future hosted authenticated lane

The current `Hosted Quality` workflow is credential-free and intentionally does not run
Playwright. A later authorized authenticated lane needs an isolated non-production deployment,
serialized fixture ownership, `E2E_STAFF_PASSWORD`, `E2E_SEED_SECRET`,
`E2E_PROVISIONING_TARGET=preview`, `NEXT_PUBLIC_CONVEX_SITE_URL`, and the implemented
`BROWSER_SMOKE_BASE_URL`. It must preserve strict preflight, never seed Production, and record its
exact revision/target separately from local and Production evidence. The strict reporter already
emits those approved identity fields, but no hosted workflow is authorized or implemented here. No
tracked instruction uses an unsupported alternate E2E base-URL variable.

The Preview public adapter is separate from `verify:local`, requires an explicit non-production
target ID and non-loopback HTTPS URL, runs no seed/auth setup, and records only the
`preview-public-smoke` release-evidence scope. Its credential-free selection includes the public
accessibility matrix and current Sacred Bharat completion/restart tracer. Production is deliberately
not a supported target.

## Related docs

- `docs/BROWSER_SMOKE.md` — navigation-only smoke
- `docs/adr/0005-playwright-crm-interaction-tests.md` — harness decision
