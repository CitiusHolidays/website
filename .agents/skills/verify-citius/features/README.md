# Citius verification map

The maintained source for proving user-facing Citius behavior locally. Read this index, then use the
matching feature file as the recipe. Staff Workspace and Customer Account are separate surfaces with
separate identities (`CONTEXT-MAP.md`); never use one as evidence for the other.

## Baseline preconditions

- Instance launched with `scripts/citius-local.sh launch <port>` and `doctor <port>` exits 0.
- `BROWSER_SMOKE_BASE_URL=http://localhost:<port>` exported in the shell that drives.
- Anonymous runs only read the shared `dev:` Convex deployment. No form submissions.
- Never drive an instance this run did not start.

## Sign-in requirements and test accounts

| Surface | Anonymous state you can prove | Signed-in state needs |
| --- | --- | --- |
| Public site, Sacred Bharat (guest) | Everything in `public-site.md`, `sacred-bharat.md` | — (Yatri sign-in is optional) |
| Customer Account `/account` | Redirect to `/auth/guest`, sign-in form | Seeded `e2e-customer@citius-e2e.test` on an approved non-production target |
| Staff Workspace `/portal` | Redirect to `/auth/connect`, sign-in form | Seeded `e2e-<role>@citius-e2e.test` profiles on an approved non-production target |

Test accounts are only the synthetic identities in `config/e2e-staff-profiles.json` (domain
`citius-e2e.test`: admin, sales, contracting, operations, ticketing, ticketing-head, finance, accounts,
hr, leave-head, sales-cement, contracting-cement) plus the customer fixture created by the E2E seed.
They exist only after the protected seed runs against a target approved in
`.scratch/e2e/approved-targets.json`; their shared password is `E2E_STAFF_PASSWORD`, never committed
or printed. Never sign in with a real staff or customer account, and never seed the owner's shared
`dev:` deployment or anything Production-class. If no approved target exists, report signed-in
journeys as "not run: no approved seeded target" — that is the honest local result.

## Driving conventions

- Prefer ARIA roles/names (`agent-browser snapshot -i`, Playwright `getByRole`) over CSS or position.
- Treat the commands as literal. Smoke case IDs come from `config/browser-smoke.json`.
- Capture URL + ARIA + screenshot for each proved state; keep artifacts in
  `.scratch/verify-citius/evidence/`.
- A failed or skipped case is reported with its reason. Never weaken a case or manifest entry to pass.

## Features

- [Public site](./public-site.md) — home, pilgrimage, trail pages on desktop and mobile.
- [Sacred Bharat](./sacred-bharat.md) — guest landing and its event gateway.
- [Customer Account](./customer-account.md) — `/account` gate, guest sign-in, confirmed-trip packet.
- [Staff Workspace](./staff-workspace.md) — `/portal` gate, Citius Connect sign-in, role routes.
