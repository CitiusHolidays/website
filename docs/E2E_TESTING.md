# Playwright CRM interaction tests (hybrid harness)

Citius Connect uses a **hybrid** browser test stack: `agent-browser` navigation smoke (`bun run smoke:browser`) checks that routes render for each role without clicking forms, while **Playwright** (`bun run test:e2e`) owns modal open/save/delete flows and multi-step Query → Job Card handoffs. Playwright does not replace `bun test` contract suites or Convex policy unit tests.

**Scope today:** local developer runs only. Playwright specs skip when `E2E_STAFF_PASSWORD` is unset. CI gates and staging deploy keys are deferred (see [Future: CI](#future-ci)).

## Commands

| Command | What it runs |
|---------|----------------|
| `bun run test` | Unit + contract tests (Playwright specs excluded) |
| `bun run test:local` | `bun run test` then `bun run test:e2e` (e2e skips without credentials) |
| `bun run test:e2e` | All Playwright interaction specs |
| `bun run test:e2e:critical` | `@critical` tag only |
| `bun run test:e2e:smoke` | `@smoke` tag only |
| `bun run test:e2e:workflow` | `@workflow` tag only |

Tags: `@critical`, `@smoke`, `@workflow`.

## Local setup

1. Start app + Convex dev (`bun run dev:all`).
2. Add to **Convex dashboard** (your dev deployment) and **`.env.local`**:

   | Variable | Where | Value |
   |----------|--------|--------|
   | `E2E_SEED_SECRET` | Convex + `.env.local` | Any long random string you choose |
   | `E2E_STAFF_PASSWORD` | Convex + `.env.local` | Shared test password (min 8 chars) |
   | `BROWSER_SMOKE_BASE_URL` | `.env.local` optional | Defaults to `http://localhost:3000` |

3. Seed staff + auth (once per deployment, or after password rotation):

   ```bash
   bunx convex run crm/e2eSeedActions:run '{"secret":"YOUR_E2E_SEED_SECRET"}'
   ```

4. Run tests:

   ```bash
   bun run test:local
   # or just interaction layer:
   bun run test:e2e:critical
   ```

Staff emails are in `config/e2e-staff-profiles.json` (`e2e-{role}@citius-e2e.test`). Passwords are never committed.

Set `E2E_STRICT=1` to fail fast when credentials are missing (optional; default is skip with warning).

## Auth storage

`e2e/global-setup.ts` signs each profile in through `/auth/connect` and writes `e2e/.auth/{role}.json` (gitignored). Specs load these via Playwright `storageState`.

## Matrix

`e2e/registry/portalViews.ts` lists every portal view ID with planned roles/actions. `PORTAL_E2E_IMPLEMENTED_VIEWS` marks views covered by live specs (05–15). Remaining cells emit skipped `@smoke` stubs in `e2e/specs/matrix/unimplemented-views.spec.ts`.

| View | Spec |
|------|------|
| `queries`, `proposals` | `e2e/specs/critical-path.spec.ts` |
| `accounts-job-cards`, `travellers` | `e2e/specs/critical-path.spec.ts` |
| `tickets` | `e2e/specs/ticketing-row-edit.spec.ts` |
| `expenses` | `e2e/specs/finance-expense.spec.ts` |
| `employees-on-leave` | `e2e/specs/hr-leave.spec.ts` |
| `settings` | `e2e/specs/admin-settings.spec.ts` |
| `passport` | `e2e/specs/passport-modal.spec.ts` |

`@workflow` delete specs call `convex run crm/e2eAssertions:travellerExists` and need `E2E_SEED_SECRET` in the shell environment.

## Failure artifacts

Playwright retains trace, screenshot, and video on failure under `.scratch/playwright-results`. Logs should be redacted before sharing (see `e2e/fixtures/redact.ts`).

## Future: CI

Not wired today. When you want PR/nightly gates, you will need:

- A reachable app URL (Vercel preview/staging) or a workflow that starts `next start` in the job
- `CONVEX_E2E_DEPLOY_KEY` for seeding a dedicated test Convex deployment
- GitHub secrets: `E2E_STAFF_PASSWORD`, `E2E_SEED_SECRET`, and optionally `E2E_BASE_URL`

Track in `.scratch/crm-e2e-testing/issues/17-ci-pr-critical-gate.md` and related tickets. `bun run check` and `required-quality.yml` stay unchanged (no Playwright in CI).

## Related docs

- `docs/BROWSER_SMOKE.md` — navigation-only smoke
- `docs/adr/0005-playwright-crm-interaction-tests.md` — harness decision
- `.scratch/crm-e2e-testing/PRD.md` — full spec
