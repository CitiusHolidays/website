# Browser smoke harness

The browser smoke manifest covers public, authentication, and high-value portal routes without
checking credentials, cookies, record IDs, or user data into the repository.

## Prepare role sessions

Use deterministic local test identities provisioned for the named role. Sign each identity into an
isolated `agent-browser` session, then export only the session identifier:

```bash
export BROWSER_SMOKE_ADMIN_SESSION=citius-smoke-admin
export BROWSER_SMOKE_SALES_SESSION=citius-smoke-sales
export BROWSER_SMOKE_CONTRACTING_SESSION=citius-smoke-contracting
export BROWSER_SMOKE_OPERATIONS_SESSION=citius-smoke-operations
export BROWSER_SMOKE_TICKETING_SESSION=citius-smoke-ticketing
export BROWSER_SMOKE_FINANCE_SESSION=citius-smoke-finance
export BROWSER_SMOKE_HR_SESSION=citius-smoke-hr
```

Credentials remain in the browser's encrypted/session storage. CI should restore equivalent state
from its secret store before invoking the harness. Never put passwords or exported browser state in
the manifest.

## Run

```bash
bun run smoke:browser --strict
```

For a local subset:

```bash
bun run smoke:browser --profiles=public,admin
```

`--strict` fails when any selected case is skipped. Without it, missing role sessions and optional
record-specific scenarios are reported as skipped. Override the server with
`BROWSER_SMOKE_BASE_URL` or `--base-url=https://...`. Use `bun run smoke:browser:public` for the
strict credential-free public subset and `bun run smoke:browser:authenticated` for the strict
session-backed Staff subset; the latter fails if any selected case is skipped. The unsuffixed
command is optional discovery and includes record-URL cases that may legitimately skip.

The notification deep-link, deletion-progress, and configured/unconfigured AI cases accept real,
non-secret target URLs through `BROWSER_SMOKE_NOTIFICATION_URL`,
`BROWSER_SMOKE_DELETE_JOB_CARD_URL`, `BROWSER_SMOKE_AI_CONFIGURED_URL`, and
`BROWSER_SMOKE_AI_UNCONFIGURED_URL`. This keeps volatile record IDs and environment topology out of
source.

Each case clears its session's console, page-error, and network buffers before navigation. A case
fails when any browser command exits nonzero, a console/page error survives a narrow per-case
allowlist, or a same-origin document/XHR/fetch request fails. An expected heading cannot mask those
health failures. Reviewed allowlists are literal, narrow substrings in `config/browser-smoke.json`;
the manifest rejects wildcard or empty entries.

Failures capture route, role, screenshot, browser console, page errors, command exit status, and network context under
`.scratch/browser-smoke`. Text evidence is redacted for email addresses, authorization/cookie
headers, and common secret-bearing query parameters.

## Not covered here

Browser smoke opens routes and asserts visible text only. It does **not** click Create/Edit/Delete,
open entity modals, or submit forms. Use Playwright CRM interaction tests (`docs/E2E_TESTING.md`)
for modal and CRUD coverage. Authenticated cold/warm route budgets are a separate Playwright
contract documented in [`docs/STAFF_WORKSPACE_PERFORMANCE.md`](STAFF_WORKSPACE_PERFORMANCE.md).
