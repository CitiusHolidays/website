# Citius Holidays Website

A full-stack travel platform for Citius Holidays: public marketing site, staff CRM portal (Citius Connect), guest accounts, Sacred Bharat gamification, and Convex-backed operations workflows.

## Project overview

### Public site

- Marketing pages: home, about, services, MICE, gallery, blog, contact, policies
- Pilgrimage content and spiritual trail pages
- **Sacred Bharat** (`/sacred-bharat`) — temple check-ins, trails, badges, leaderboard, groups, and AI Journey Planner
- **Citius Concierge** — on-site AI chatbot (OpenRouter)
- Contact form with Resend email delivery and Cloudflare Turnstile bot protection
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

Operational details: [`docs/PORTAL_CRM_WORKFLOWS.md`](docs/PORTAL_CRM_WORKFLOWS.md), [`docs/PORTAL_ROLES_AND_ACCESS.md`](docs/PORTAL_ROLES_AND_ACCESS.md), [`docs/PORTAL_PERMISSIONS_ARCHITECTURE.md`](docs/PORTAL_PERMISSIONS_ARCHITECTURE.md).

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
| AI | [OpenRouter](https://openrouter.ai/) via Vercel AI SDK (chatbot, Sacred Bharat journey planner) |
| Lint / format | [Ultracite](https://www.ultracite.ai/) (Biome presets) |
| Language | TypeScript migration in progress; JS and TS coexist in `src/` and `convex/` |
| Orchestration | [Effect](https://effect.website/) at integration seams only (payments, email, imports) |
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
  sacredBharat.ts      # Sacred Bharat progress sync
  bookings.ts          # Razorpay booking mutations

citius-blog/           # Sanity Studio (blog + gallery schemas)
docs/                  # Portal workflow and permissions documentation
scripts/               # Image optimization utilities
bin/                   # Perf baseline and hero encoding scripts
plans/                 # Implementation plans (status tracked in plans/README.md)
```

## Getting started

### 1. Install dependencies

```bash
bun install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in values. Key groups:

**Required for local dev**

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
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

# Passport scan encryption (also set in Convex: bunx convex env set ENCRYPTION_KEY <value>)
ENCRYPTION_KEY=              # node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Optional / feature-specific**

```env
# Google OAuth (staff and guest sign-in)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Contact form bot protection
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# AI chatbot and Sacred Bharat journey planner
OPENROUTER_API_KEY=

# Razorpay bookings
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
PAYMENT_MUTATION_SECRET=

# Sanity webhook revalidation
SANITY_REVALIDATE_SECRET=

# Staff bootstrap and one-off migrations
PORTAL_BOOTSTRAP_ADMINS=admin@example.com
MIGRATION_SECRET=
```

`SITE_URL`, `BETTER_AUTH_URL`, and `NEXT_PUBLIC_APP_URL` must include the `http://` or `https://` scheme. Restart the Next.js dev server fully after changing auth-related env vars.

Set Convex-side secrets with `bunx convex env set KEY value` (or the Convex dashboard).

### 3. Run development servers

Run **both** Convex and Next.js:

```bash
# Terminal 1 — Convex backend (watches schema and functions)
bun run convex:dev

# Terminal 2 — Next.js frontend
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other dev commands:

- `bun run dev:webpack` — Next.js without Turbopack
- `bun run dev:reset` — Clear `.next` cache and restart

### 4. Sanity Studio

Blog and gallery content are managed in Sanity. From `citius-blog/`:

```bash
bun install
bun run dev
```

### 5. Production build

```bash
bun run build
bun run start
```

`build` runs `convex codegen` first. The `convex/_generated/` folder is gitignored; CI and Vercel regenerate it on each deploy.

## Scripts

| Script | Description |
| --- | --- |
| `dev` | Next.js dev server (Turbopack) |
| `dev:reset` | Clear `.next` and start dev |
| `dev:webpack` | Next.js dev without Turbopack |
| `build` | Convex codegen + production build |
| `start` | Production server |
| `lint` | Ultracite check (Biome) |
| `lint:fix` / `format` | Auto-fix with Ultracite |
| `lint:doctor` | Ultracite doctor |
| `typecheck` | Next route typegen + `tsc` |
| `test` | Bun test suite |
| `check` | Lint + test |
| `doctor` | React Doctor analysis |
| `convex:dev` | Convex dev deployment |
| `convex:codegen` | Regenerate Convex API types |
| `auth:schema:generate` | Regenerate Better Auth Convex schema |
| `optimize-images` | Batch image optimization |
| `perf:hero-baseline` | Hero video performance baseline |

After Convex schema or API changes, run `bunx convex codegen`. After dependency changes, run `bun audit`.

## TypeScript and Effect

The codebase is migrating to TypeScript file by file. Use plain TypeScript by default.

Use **Effect** only when a module has at least two orchestration pressures: external I/O, retry/throttle, concurrency control, typed recoverable errors, rollback/cleanup, or test-time dependency substitution. Do not use Effect for simple async functions, React state, or ordinary Convex validators.

Examples: `src/lib/effectAdoption.ts`. Run `bun run typecheck` for app/source TypeScript; keep Convex type generation separate via `bunx convex codegen`.

## Deploy

Deploy on [Vercel](https://vercel.com/). Recommended Convex hosting pattern:

```bash
bunx convex deploy --cmd 'bun --bun next build'
```

On Vercel:

1. Set `CONVEX_DEPLOY_KEY` (Convex dashboard → Project Settings → Deploy Key).
2. Mirror all required env vars from `.env.local` in Vercel project settings.
3. Set Convex env vars in the Convex dashboard for server-side secrets (`ENCRYPTION_KEY`, `RESEND_API_KEY`, etc.).

The project targets Vercel `bom1` with Bun 1.x (`vercel.json`).

## Contributing

1. Fork the repo and branch from `main`.
2. `bun install`, then run `bun run convex:dev` and `bun run dev`.
3. Verify changes with `bun run check` (lint + tests). For portal UI changes, also run `bun run doctor`.
4. After Convex changes, run `bunx convex codegen` and relevant tests.
5. Open a pull request with a clear description.

Agent and workspace conventions live in [`AGENTS.md`](AGENTS.md).

## Learn more

- [Next.js docs](https://nextjs.org/docs)
- [Convex docs](https://docs.convex.dev/)
- [Better Auth + Convex](https://www.better-auth.com/docs/integrations/convex)
- [Sanity docs](https://www.sanity.io/docs)
- [Tailwind CSS docs](https://tailwindcss.com/docs)

---

© Citius Holidays. All rights reserved.
