---
name: verify-citius
description: Prove Citius website behavior locally the way a visitor, Account Holder, or Staff member would — launch `next dev` on a private port, run the read-only doctor, drive the public site, Customer Account, and Staff Workspace with the repo's browser harnesses (agent-browser smoke, Playwright), capture evidence, and report each evidence state honestly. Use after a change to public pages, auth gates, `/account`, or `/portal`, or whenever a task must show that a route works rather than that it compiles.
---

# verify-citius

Local runtime proof for this repo. It complements, never replaces, the command gates in
`docs/VERIFICATION.md`. Read `features/README.md` before driving; each feature file is the recipe.

## Evidence states — say which one you reached

`docs/VERIFICATION.md` owns this vocabulary. These states are separate; a later one never implies
an earlier one, and none of them implies another:

| State | How you get it here | It does not prove |
| --- | --- | --- |
| Local checks | `bun run lint:all`, `bun run typecheck`, `bun run convex:typecheck`, `bun run test`, `bun run doctor -- --verbose` (100/100), or `bun run verify:local` for the full gate | Any browser behavior, publication, deployment |
| Local browser proof (anonymous) | This skill's launch → doctor → drive against `http://localhost:<port>` | Signed-in behavior, Preview, Production |
| Local authenticated interaction | `bun run test:e2e:*` strict lanes against an approved, seeded, non-production target (see Staff/Customer feature files) | Untested roles, deployment, Production |
| Publication | A pushed Git ref | Any deployment |
| Preview/Production deployment, migrations, database writes, authenticated live proof | `RELEASE.md` only, with the exact target named and fresh explicit authority | — |

Rules: never use Vercel Preview URLs or `vercel curl` for verification (owner decision: verify locally
and in CI). Credential-dependent skips are not passing evidence. Report every case that failed or was
not run, with the reason, next to the ones that passed.

## Launch

Prerequisites, once per checkout:

- `bun install --frozen-lockfile` at the root (and in `citius-blog/` only if Studio is in scope).
- `.env.local` copied from the owner's checkout (ignored; never commit, never print values). It must
  name `CONVEX_DEPLOYMENT=dev:<name>`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, and
  `NEXT_PUBLIC_SANITY_DATASET`. Without the two Sanity keys `/pilgrimage*` returns 500
  (`Configuration must contain projectId`). Do not copy the owner's `.env`: it holds live provider
  keys (mail, payments) that a local run must not be able to use.
- `agent-browser` ≥ 0.31.1 on `PATH` (repo smoke harness). Playwright lanes also need the pinned
  browser build: `bunx playwright install chromium` (a download — get approval first).

Start an instance on a private port (default 3117) so parallel agents and the owner's `:3000` server
never collide:

```bash
.claude/skills/verify-citius/scripts/citius-local.sh launch 3117
```

It refuses a busy port, starts `bun run dev -- --port 3117` in its own process group with
`SITE_URL`/`BETTER_AUTH_URL`/`NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_SITE_URL` pointed at that port, waits
for `Ready in`, then requires `GET /` = 200 (first compile can take ~30 s). Log:
`.scratch/verify-citius/next-dev-3117.log`.

Do **not** run `bun run dev:all` / `convex dev` from a worktree for verification: it pushes this
checkout's Convex functions to the shared `dev:` deployment the owner's checkout also uses. Next.js
alone reads the already-deployed dev backend. If the change touches `convex/`, local browser proof
of it needs an isolated backend (see `features/staff-workspace.md`) or stays "not run".

## Doctor

Run first, and whenever anything looks off:

```bash
.claude/skills/verify-citius/scripts/citius-local.sh doctor 3117
```

Read-only. It runs `bun run dev:doctor -- --profile public` (repo policy: runtime pins, key names,
dev-only target, no E2E settings in the plain shell), then checks that the port is owned by the
process group this script started, the revision, the required `.env.local` key names, `GET /` = 200,
`GET /account` = 307 → `/auth/guest`, and `/_next/mcp` `get_compilation_issues`. Exit 0 means the
instance is worth driving. `dev:doctor` requires Bun exactly `1.4.0` (`package.json#packageManager`);
on another patch it prints a finding — record it in the report rather than claiming a clean doctor.
Never drive a port the doctor says you do not own.

## Drive

Two harnesses, both pointed at the instance with `BROWSER_SMOKE_BASE_URL=http://localhost:3117`:

- **agent-browser smoke** (`scripts/browser-smoke.ts`, cases in `config/browser-smoke.json`):
  opens routes, asserts visible text/path, and fails on page errors, console errors, and failed
  same-origin requests. Strict anonymous lane: `bun run smoke:browser:public`.
- **Playwright**: `bun run test:e2e:public-instant` (credential-free, `e2e/public/`), and the strict
  authenticated tags `test:e2e:smoke|critical|workflow` (need a seeded target).

For ad-hoc steps use agent-browser with a named session and accessible handles, never coordinates:

```bash
export AGENT_BROWSER_SESSION=verify-citius-drive
agent-browser open http://localhost:3117/account && agent-browser wait --load networkidle
agent-browser get url                      # expect http://localhost:3117/auth/guest
agent-browser snapshot -i                  # heading "Welcome back", textbox "Email Address", button "Sign in"
```

Cross-check with Next's own view (SSE; read the `data:` line):

```bash
curl -s -X POST http://localhost:3117/_next/mcp -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_errors","arguments":{}}}' \
  | sed -n 's/^data: //p'
```

Which states need sign-in, and the test accounts that exist, are in `features/README.md`.

## Evidence

Write proof under `.scratch/verify-citius/evidence/` (ignored): the command and its pass/fail lines
(`… | tee .scratch/verify-citius/evidence/<name>.txt`), `snapshot -i` output as `<name>.aria.txt`, and
a screenshot showing the Citius identity. Smoke failures land in `.scratch/browser-smoke/` (redacted
JSON + PNG; copy them into the evidence directory because the next smoke run overwrites them);
Playwright failures in `.scratch/playwright-results/` or `.scratch/e2e-public/`.

Proof standards: drive the real user path (no internal setters, no test-only endpoints in anonymous
runs); capture the action and the resulting state (URL + ARIA), not only a final screenshot; never
submit a form that writes to the shared dev deployment (contact/enquiry, sign-up, Sacred Bharat
events) — that is a database write and needs its own authority; record the revision and whether the
tree was dirty.

Report template:

```text
Target: local next dev http://localhost:<port>, Convex dev:<name> read-only, revision <sha>[+dirty]
Local checks: <each gate: pass/fail/not run>
Local browser proof: <case: pass/fail (reason)> …
Not run: authenticated Staff/Customer journeys (<reason>), Preview, Production, migrations
```

## Cleanup

```bash
.claude/skills/verify-citius/scripts/citius-local.sh stop 3117
```

Kills only the process group this script started, closes the smoke session and
`$AGENT_BROWSER_SESSION`, confirms the port is free, removes only the Playwright HTML viewer bundle
(see Gotchas), and keeps `.scratch/verify-citius/`, `.scratch/browser-smoke/`, and
`.scratch/e2e-public/results/`. Never `pkill next`/`pkill node`: other agents and
the owner run their own servers.

## Gotchas

- `next dev` rewrites the generated block in `AGENTS.md` (`#` → `##`). `launch` restores it when the
  file was clean before; otherwise check `git diff AGENTS.md` before committing.
- agent-browser sessions go stale: a blank read, `about:blank`, `Browser not launched`, or
  `No active page` right after `open` is the tool, not the route. `agent-browser --session <s> close`,
  then reopen. Re-opening the same URL after switching viewport (desktop `public-home` then mobile
  `public-home-mobile` in one session) reliably drops the page; run the mobile case in a fresh session
  (close the `citius-browser-smoke-public` session first). Warm the session with one `open` of the base
  URL before a multi-case run.
- `sacred-bharat` fails strict smoke with `POST /api/sacred-bharat/events 503` unless
  `SACRED_BHARAT_EVENT_GATEWAY_SECRET` is configured. That 503 is the intended unconfigured response;
  configuring the secret makes browsing write analytics events to the dev deployment. Report the case
  as failed for that reason; do not configure the secret just to turn it green.
- `/portal` returns HTTP 200 to curl; the Staff gate is client-side (`PortalAuthBoundary`). Prove it in
  a browser: the URL settles on `/auth/connect`.
- Better Auth runs on the Convex deployment with that deployment's `SITE_URL` (`http://localhost:3000`
  for the owner's dev target). Anonymous pages work on any port; a real sign-in from another port may
  be refused as an untrusted origin. Signed-in proof belongs to the isolated E2E target.
- `bun run test:e2e:public-instant` writes an HTML report to `.scratch/e2e-public/report/`; React Doctor
  scans it and drops to 80/100 (`insecure-crypto-risk` in the trace viewer bundle), and its scan cache
  in `node_modules/.cache/react-doctor` keeps the stale finding after the files are gone. `stop`
  removes both; do it before running `bun run doctor -- --verbose`.
- Dev-mode first loads compile on demand; a slow first response is not a failure. Wait with
  `agent-browser wait --load networkidle`, not fixed sleeps.
