# Customer Account

Account Holders sign in at the guest sign-in page and see only the journeys granted to them, read-only,
without Staff or payment data. Anonymous visitors to `/account` are sent to sign in.

## Sub-features

- `account-redirect` anonymous `/account` lands on `/auth/guest` with heading "Welcome back".
- `account-sign-in-form` the form exposes textbox "Email Address", textbox "Password", link "Forgot
  password?", buttons "Sign in", "Sign up", "Continue with Google".
- `account-confirmed-trip` a signed-in Account Holder sees the "Confirmed trip packet" for the seeded
  journey and no selling price, tax, creator, or payment fields.

## How to get to it (user POV)

- Open `/account`, or "Sign in" from the public site; the app link `/app/sign-in` for the installed app.

## Driving it with agent-browser and Playwright

Preconditions:

- Doctor exits 0 (it already asserts `GET /account` → 307 `/auth/guest`).
- Signed-in steps only: an approved non-production target seeded per `docs/E2E_TESTING.md`.

- **Gate.** `bun scripts/browser-smoke.ts --profiles public --cases account-redirect --strict` reads
  `passed  account-redirect`.
- **Form.** `agent-browser open $BROWSER_SMOKE_BASE_URL/account`, `agent-browser wait --load
  networkidle`, `agent-browser get url` → `/auth/guest`; `agent-browser snapshot -i` lists the handles
  above. Save as `evidence/account-unauth.aria.txt` plus a screenshot.
- **Confirmed trip (signed in).** `bun run test:e2e:critical -- e2e/specs/customer-account-confirmed-trip.spec.ts`
  against the approved target. Global setup signs in `e2e-customer@citius-e2e.test` at `/auth/guest`
  and stores `e2e/.auth/customer.json`. Without that target, report "not run".

## Gotchas

- Do not press "Sign up" or submit the form against the shared dev deployment: it creates or probes
  real auth records.
- Customer Account proof is never Staff proof, and a matching email never merges authority.
