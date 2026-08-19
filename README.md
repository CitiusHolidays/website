# Citius Holidays Website

A full-stack travel platform for Citius Holidays: public marketing site, staff CRM portal (Citius
Connect), guest accounts, the Sacred Bharat social-edition series, and Convex-backed operations
workflows.

## Project overview

### Public site

- Marketing pages: home, about, services, MICE, gallery, blog, contact, policies
- Pilgrimage content and spiritual trail pages
- **Sacred Bharat** (`/sacred-bharat/001`) — a five-detail cultural-recognition edition with
  immediate reveals, personal 9:16 result artifacts, and anonymous friend-attributed replays
- **Citius Concierge** — on-site AI chatbot (OpenRouter)
- Consented Website enquiries with durable Sales triage, tracked Resend delivery to Sales and
  `info@citius.in`, and Cloudflare Turnstile bot protection
- Sanity CMS for blog and gallery content

### Authenticated experiences

| Route | Audience | Purpose |
| --- | --- | --- |
| `/auth/guest` | Public visitors | Guest sign-in → `/account` |
| `/auth/connect` | Staff | Citius Connect sign-in → `/portal` |
| `/auth/vendor` | Vendors | Vendor sign-in (UI hidden until implemented) |
| `/account` | Guests | Profile and bookings |
| `/portal` | Staff | CRM and operations workspace |

Auth uses **Better Auth** with Google and email/password. Staff records live in Convex (`staffUsers`, `userProfiles`) and are synced by email.

### Citius Connect portal

Role-based CRM for sales through finance and operations:

- **Sales flow** — queries, proposals, sales decisions, pipeline
- **Contracting** — costing, proposals, send-to-sales handoff
- **Operations** — job cards, travellers, visa, passport, hotels/rooming, tour managers
- **Ticketing** — PNRs, tickets, seat allocation
- **Accounts & finance** — job-card creation, invoices, expenses, approvals
- **HR** — leave requests, two-stage approvals, approver matrix
- Spreadsheet import/export for passenger, passport, visa, ticketing, and rooming data
- In-app notifications, saved views, command palette (⌘K / Ctrl+K), and role-based dashboard
- Bounded Queries, Proposals, and Job Cards reads with cursor loading and authenticated
  cold/warm performance budgets
- Replay-safe proposal handoff, order confirmation, passenger imports, and exports with durable
  progress records
- Privacy-safe notification email delivery summaries for department heads, Directors, Director
  Cement, and Admin

Operational details: [`docs/PORTAL_CRM_WORKFLOWS.md`](docs/PORTAL_CRM_WORKFLOWS.md), [`docs/PORTAL_ROLES_AND_ACCESS.md`](docs/PORTAL_ROLES_AND_ACCESS.md), [`docs/PORTAL_PERMISSIONS_ARCHITECTURE.md`](docs/PORTAL_PERMISSIONS_ARCHITECTURE.md).
Staff Workspace performance and replay-safety contracts live in
[`docs/STAFF_WORKSPACE_PERFORMANCE.md`](docs/STAFF_WORKSPACE_PERFORMANCE.md).

Start from the task-oriented [`docs/README.md`](docs/README.md), the bounded
context router in [`CONTEXT-MAP.md`](CONTEXT-MAP.md), and the design authority
router in [`DESIGN.md`](DESIGN.md). Historical `plans/` links are mapped in
[`docs/PLAN_MAP.md`](docs/PLAN_MAP.md). GitHub Issues own published specs and
implementation tickets; `.scratch/` is for local briefs, evidence, and handoffs.

### Last published release checkpoint

The dated Staff Workspace scale and replay-safety checkpoint is `7fa38a0`.
Historical local verification and deferred work are recorded in the tracked
[working-tree summary](docs/WORKING_TREE_CHANGES.md); that page is not current
branch, deployment, or Production proof. Use
[`docs/VERIFICATION.md`](docs/VERIFICATION.md) for current evidence vocabulary.
The local `.scratch/README.md` is an optional workspace mirror and is intentionally gitignored; it
is not required to understand or release the repository.

### Payments

Razorpay integration for trip bookings: create order, verify payment, webhook handling. Convex stores booking state.

## Tech stack

| Layer | Tools |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org/) (App Router, React Compiler, Turbopack dev) |
| UI | [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Motion](https://motion.dev/) |
| Runtime / package manager | [Bun](https://bun.sh/) |
| Backend / database | [Convex](https://www.convex.dev/) |
| Auth | [Better Auth](https://www.better-auth.com/) via `@convex-dev/better-auth` |
| CMS | [Sanity](https://www.sanity.io/) (Studio in `citius-blog/`) |
| Email | [Resend](https://resend.com/) + [React Email](https://react.email/) |
| Payments | [Razorpay](https://razorpay.com/) |
| AI | [OpenRouter](https://openrouter.ai/) via Vercel AI SDK (Citius Concierge and retained Sacred Bharat journey-planner backend) |
| Lint / format | [Ultracite](https://www.ultracite.ai/) (Biome presets) |
| Language | TypeScript migration in progress; JS and TS coexist in `src/` and `convex/` |
| Orchestration | [Effect](https://effect.website/) only where multiple pressures materially simplify one workflow; payment boundaries use plain TypeScript |
| Deploy | [Vercel](https://vercel.com/) (`bom1` region, Bun 1.x) |

## Folder structure

```
src/
  app/
    (public)/          # Marketing, blog, gallery, pilgrimage, sacred-bharat, contact
    (auth)/            # Guest, staff (connect), vendor, forgot/reset password
    (authenticated)/   # Guest account, vendor placeholder
    portal/            # Citius Connect routes (queries, job cards, finance, etc.)
    api/               # Auth, contact, chat, payments, webhooks, portal file downloads
  components/          # UI, layout, portal, sacred-bharat, pilgrimage, account
  lib/                 # Portal helpers, auth, contact, sacred-bharat, razorpay, email
  data/                # Static content (temples, trails, destinations)
  emails/              # React Email templates
  sanity/              # Sanity client and image URL helpers

convex/
  crm/                 # Portal CRM (queries, proposals, job cards, leave, imports, …)
  betterAuth/          # Better Auth component (schema, adapter, auth config)
  lib/                 # Shared backend utilities (auth sync, encryption, room types)
  schema.ts            # Database schema
  sacredBharatEditionEvents.ts # Edition 001 anonymous engagement and attribution
  bookings.ts          # Razorpay booking mutations

citius-blog/           # Sanity Studio (blog + gallery schemas)
docs/                  # Product, domain, release, and operational documentation
scripts/               # Image optimization utilities
config/release/        # Target-neutral release, performance, and documentation checks
```

## Getting started

### 1. Install dependencies

```bash
bun install --frozen-lockfile
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in values. Key groups:

The canonical key-only scope list is [`config/environment.manifest.json`](config/environment.manifest.json).
Release activation, preview isolation, deploy-key scope, and rollback are documented in
[`RELEASE.md`](RELEASE.md).

**Required for local dev**

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3000
SITE_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000

# Better Auth
BETTER_AUTH_SECRET=          # openssl rand -base64 32

# Sanity
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=production

# Email
RESEND_API_KEY=
# Temporary legacy alias; migrate to RESEND_API_KEY before 2026-09-30.
RESEND_KEY=

# Passport scan encryption (also set in Convex: bunx convex env set ENCRYPTION_KEY <value>)
ENCRYPTION_KEY=              # node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Document Preview is fully enabled by default. Set the same stage in Next and Convex;
# use off as the emergency kill switch or a narrower stage for a deliberate rollback:
# off | commercial-native | commercial-office | commercial-chain | sensitive | all
NEXT_PUBLIC_DOCUMENT_PREVIEW_ROLLOUT_STAGE=all
DOCUMENT_PREVIEW_ROLLOUT_STAGE=all
# Required only when the isolated Office artifact worker is operated.
DOCUMENT_PREVIEW_WORKER_SECRET=
```

**Optional / feature-specific**

```env
# Google OAuth (staff and guest sign-in)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Contact form bot protection
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
INBOUND_INTENT_GATEWAY_SECRET=
INBOUND_INTENT_RATE_LIMIT_SALT=

# AI chatbot and Sacred Bharat journey planner
OPENROUTER_API_KEY=
AI_RATE_LIMIT_SALT=
AI_RUNTIME_SECRET=

# Razorpay bookings
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
PAYMENT_MUTATION_SECRET=

# Sanity webhook revalidation
SANITY_REVALIDATE_SECRET=

# Staff bootstrap and one-off migrations
PORTAL_BOOTSTRAP_ADMINS=admin@example.com
# Required while the allowlist is populated; ISO timestamp or epoch milliseconds.
PORTAL_BOOTSTRAP_ADMINS_EXPIRES_AT=
MIGRATION_SECRET=
```

`SITE_URL`, `BETTER_AUTH_URL`, and `NEXT_PUBLIC_APP_URL` must include the `http://` or `https://` scheme. Restart the Next.js dev server fully after changing auth-related env vars.

Set Convex-side secrets with `bunx convex env set KEY value` (or the Convex dashboard).
`AI_RUNTIME_SECRET` must be set to the same rotated value in both the Next.js server environment and Convex. Run `bun run ai:config-check` before deployment; it validates runtime grouping without reading or printing secret values.

### 3. Run development servers

Run the no-network local doctor first, choosing only the surface you need:

```bash
bun run dev:doctor -- --profile public
bun run dev:doctor -- --profile portal
```

For portal work, `dev:doctor` fails closed if the configured Convex target is
not explicitly a development deployment, if auth origins disagree, or if
deployment/E2E credentials are present. It prints variable names and target
classification, never secret values.

Then run **both** Convex and Node-hosted Next.js under the Convex supervisor:

```bash
bun run dev:all
```

Open [http://localhost:3000](http://localhost:3000).

Other dev commands:

- `bun run dev:webpack` — Next.js without Turbopack
- `bun run dev:reset` — Clear `.next` cache and restart
- `bun run help` — Side-effect-free package command inventory

### 4. Sanity Studio

Blog and gallery content are managed in Sanity. From `citius-blog/`:

```bash
bun install --frozen-lockfile
bun run dev
```

### 5. Production build

```bash
bun run build
bun run start
```

`build` runs `convex codegen` first. Five reviewed modules in `convex/_generated/`
(`api.d.ts`, `api.js`, `dataModel.d.ts`, `server.d.ts`, and `server.js`) are tracked so
credential-free checks work from a clean clone. Other Convex generated output remains ignored;
target-aware codegen refreshes the reviewed surface during an authorized build or deployment.

## Scripts

| Script | Description |
| --- | --- |
| `dev` | Next.js dev server (Turbopack) |
| `dev:all` | Convex and Next.js development servers together |
| `dev:doctor` | Validate local runtime, files, env names/origins, and non-production target identity without starting anything |
| `dev:reset` | Clear `.next` and start dev |
| `dev:webpack` | Next.js dev without Turbopack |
| `build` | Convex codegen + production build |
| `start` | Production server |
| `lint` | Ultracite check (Biome) plus anti-slop lint |
| `lint:all` | Zero-warning Ultracite, anti-slop, lint-baseline, and Studio ESLint gate |
| `check:fast` | Tests only |
| `lint:fix` / `format` | Auto-fix with Ultracite |
| `lint:doctor` | Ultracite doctor |
| `typecheck` | Next route typegen + `tsc` |
| `test` | Bun test suite |
| `test:e2e` / strict tagged subsets | Fail-closed authenticated Playwright evidence |
| `test:e2e:optional` | Skip-friendly Playwright discovery; not authenticated proof |
| `test:local` | Target-neutral tests followed by strict authenticated Playwright |
| `check` | Canonical zero-warning lint gate + full isolated tests with the high-risk coverage ratchet |
| `coverage:check` | Emit LCOV/JSON and enforce reviewed high-risk line, function, and branch-contract floors |
| `lint:ratchet` | Preserve the checked-in zero-diagnostic lint baseline |
| `lint:ratchet:update` | Refresh the baseline only after `lint:all` is clean |
| `deadcode` | Print the report-only pinned Knip inventory |
| `deadcode:ratchet` | Reject findings outside the reviewed dead-code allowlist |
| `help` | List package commands without executing them |
| `config:check` | Validate environment and release contracts |
| `env:preflight` | Validate target environment ownership and provisioning inputs |
| `verify:local` | Run required lint, both typechecks, all tests, and coverage with frozen dependencies |
| `automation:check` | Require a recorded human approval before destructive agent automation |
| `diff:check` | Check whitespace, secret-file, generated-output, and size hygiene |
| `assets:check` | Check public asset references and budgets |
| `performance:check` | Check public asset and authenticated Staff Workspace budgets |
| `performance:public:collect` | Collect repeated public runtime evidence from an explicit loopback Next server |
| `performance:staff:collect` | Collect strict revision-bound authenticated evidence from an explicit non-production target |
| `release:scope` | Summarize an explicit Git range, review load, risk tags, and target-neutral proof commands |
| `smoke:browser:public` / `smoke:browser:authenticated` | Strict public or session-backed browser smoke |
| `smoke:browser` | Optional all-case browser-smoke discovery |
| `browser:evidence:preview-public` | Run revision-bound credential-free public evidence against an explicit Preview |
| `doctor` | Repository-pinned local React Doctor analysis |
| `precommit:check` | Check staged whitespace and route staged source to check-only formatters |
| `convex:dev` | Convex dev deployment |
| `convex:codegen` | Regenerate Convex API types |
| `convex:typecheck` | Type-check the Convex project independently |
| `ai:benchmark` | Run the fixed non-sensitive AI runtime benchmark |
| `auth:schema:generate` | Regenerate Better Auth Convex schema |
| `optimize-images` | Batch image optimization |

After Convex schema or API changes, run `bunx convex codegen`. After dependency changes, run `bun audit --audit-level=high`. See [`docs/DEAD_CODE_INVENTORY.md`](docs/DEAD_CODE_INVENTORY.md) before acting on Knip output.

## TypeScript and Effect

The codebase is migrating to TypeScript file by file. Use plain TypeScript by default.

Use **Effect** only when a module has at least two orchestration pressures: external I/O, retry/throttle, concurrency control, typed recoverable errors, rollback/cleanup, or test-time dependency substitution. Do not use Effect for simple async functions, React state, or ordinary Convex validators.

Run `bun run typecheck` for app/source TypeScript; keep Convex type generation separate via
`bunx convex codegen`. Effect seams need direct behavior tests for the orchestration pressures they
own.

## Deploy

Deploy on [Vercel](https://vercel.com/). Recommended Convex hosting pattern:

```bash
bunx convex deploy --cmd 'bun run build'
```

On Vercel:

1. Set `CONVEX_DEPLOY_KEY` (Convex dashboard → Project Settings → Deploy Key).
2. Mirror all required env vars from `.env.local` in Vercel project settings.
3. Set Convex env vars in the Convex dashboard for server-side secrets (`ENCRYPTION_KEY`, `RESEND_API_KEY`, etc.).

The project targets Vercel `bom1` with Bun 1.x (`vercel.json`).

## Contributing

1. Fork the repo and branch from `main`.
2. `bun install --frozen-lockfile`, run the matching `bun run dev:doctor` profile, then use `bun run dev:all`.
3. Verify changes with `bun run check`, `bun run typecheck`, `bun run config:check`, and
   `bun run diff:check`. `check` includes raw lint, the same per-rule lint ratchet required by CI,
   and the full Bun test suite.
4. After Convex changes, run `bunx convex codegen`, `bun run convex:typecheck`, and relevant tests.
   For portal UI changes, also run `bun run doctor` and verify the affected routes in a browser.
5. Open a pull request with a clear description.

Keep broad `.agents/skills/` and `.claude/skills/` synchronization in a
buildable, revertible integration unit separate from product code. When a hook
or agent-tool change is directly required by the product change, name the
coupling explicitly in the commit or pull-request body. See
[`RELEASE.md`](RELEASE.md#agent-tool-integration-units).

Agent and workspace conventions live in [`AGENTS.md`](AGENTS.md).

## Learn more

- [Next.js docs](https://nextjs.org/docs)
- [Convex docs](https://docs.convex.dev/)
- [Better Auth + Convex](https://www.better-auth.com/docs/integrations/convex)
- [Sanity docs](https://www.sanity.io/docs)
- [Tailwind CSS docs](https://tailwindcss.com/docs)

---

© Citius Holidays. All rights reserved.
