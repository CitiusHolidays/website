# Citius Holidays Website 

A modern travel agency website for Citius Holidays, built with Next.js. This project showcases curated travel experiences, MICE (Meetings, Incentives, Conferences, Exhibitions) services, a blog, gallery, and more. It is designed for high performance, beautiful UI, and easy content management.

## 🚀 Project Overview

- **Purpose:**
  - Present Citius Holidays' travel, MICE, and event services.
  - Showcase destinations, partners, awards, and client testimonials.
  - Enable users to browse services, view galleries, read the blog, and contact the team.
- **Key Features:**
  - Animated, responsive UI with modern design.
  - Dynamic content: blog, gallery, and services.
  - Contact form with email integration.
  - Sanity.io integration for content management (blog, gallery, etc.).
  - SEO-friendly and optimized for fast load times.

## 🛠️ Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/)
- [Bun](https://bun.sh/) (package manager and runtime)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Biome](https://biomejs.dev/) (lint and format)
- [Sanity.io](https://www.sanity.io/) (headless CMS; Studio in `citius-blog/`)
- [Convex](https://www.convex.dev/) (database + backend functions)
- [Better Auth](https://www.better-auth.com/) (authentication)
- [Razorpay](https://razorpay.com/) (payments)
- [Resend](https://resend.com/) (transactional email service for auth and contact forms)
- [Lucide React](https://lucide.dev/) (icons)
- [Motion](https://motion.dev/) & [Motion Plus](https://motion.dev/plus) (animations)
- [React Hook Form](https://react-hook-form.com/) (forms)

## 📁 Folder Structure

- `src/app/` — Main Next.js app pages (Home, About, Services, MICE, Gallery, Blog, Contact, API routes)
- `src/components/` — Reusable UI and layout components
- `src/emails/` — Email templates for contact form
- `src/sanity/` — Sanity client configuration
- `src/static/` — Static images, videos, and assets
- `src/utils/` — Utility functions
- `convex/` — Convex schema, auth component, and backend functions
- `citius-blog/` — Sanity Studio (schemas, config, and local CMS tooling)
- `scripts/` — Maintenance and one-off developer utilities

## ⚡ Getting Started

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Run the development server:**
   ```bash
   bun run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the app.

3. **Set up environment variables:**
   Create a `.env.local` file in the root directory with:
   ```env
   # Convex (required)
   NEXT_PUBLIC_CONVEX_URL=...
   NEXT_PUBLIC_CONVEX_SITE_URL=...
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Sanity Configuration (required)
   NEXT_PUBLIC_SANITY_PROJECT_ID=your_sanity_project_id
   NEXT_PUBLIC_SANITY_DATASET=production

   # Email (Resend — verify citiusholidays.com; contact → info@citius.in is set in code)
   RESEND_API_KEY=re_your_api_key
   SITE_URL=http://localhost:3000

   # Contact form bot protection (Cloudflare Turnstile — free at dash.cloudflare.com)
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
   TURNSTILE_SECRET_KEY=your_turnstile_secret_key

   # Encryption Configuration (required for sensitive passport scans)
   # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   # Set in Convex too: bunx convex env set ENCRYPTION_KEY <same-base64-value>
   ENCRYPTION_KEY=your-32-byte-base64-encryption-key-here

   # Optional: Enable Sanity preview mode for draft content
   # SANITY_PREVIEW=true
   ```

4. **Build for production:**
   ```bash
   bun run build
   bun run start
   ```

   The build runs `convex codegen` first to create `convex/_generated/` (that folder is gitignored). On Vercel, set a **Convex deploy key** as `CONVEX_DEPLOY_KEY` in project environment variables (Convex dashboard → Project Settings → Deploy Key).

## 📜 Available Scripts

- `dev` — Start the development server
- `build` — Run Convex codegen, then build the app for production
- `start` — Start the production server
- `lint` — Run Biome checks
- `lint:fix` — Auto-fix Biome issues where possible
- `format` — Format code with Biome
- `typecheck` — Generate Next.js route types, then run the root app/source TypeScript check
- `test` — Run the test suite
- `convex:dev` — Run Convex locally and generate API artifacts
- `convex:codegen` — Regenerate Convex API types
- `auth:schema:generate` — Generate BetterAuth Convex schema file
- `optimize-images` — Optimize static images via `scripts/full-optimize-images.mjs`

## TypeScript and Effect Migration

The source migration is TypeScript-first, not Effect-first. Use plain TypeScript by default.
Use Effect only when a module has at least two orchestration pressures:

- external I/O
- retry or throttle behavior
- concurrency control
- typed recoverable errors
- rollback or cleanup
- test-time dependency substitution

Do not use Effect for simple async functions, simple React component state, straightforward
Convex validators, or ordinary Convex query/mutation business state transitions. Prefer early
Effect pilots in backend/API orchestration seams such as payment routes, notification email
delivery, spreadsheet imports, migrations, and other failure-prone integration edges.

Use `src/lib/effectAdoption.ts` and `src/lib/effectAdoption.test.ts` as the local example for the
threshold and a small typed external-I/O wrapper. Run `bun run typecheck` for migrated app/source
TypeScript and keep Convex type generation separate with `bunx convex codegen`.

## 🔧 Maintenance Scripts

Tracked utilities in `scripts/` for local development and maintenance:

- `scripts/generate-convex-export-surface.mjs` — Regenerate Convex export surface helpers
- `scripts/full-optimize-images.mjs` — Batch image optimization (also exposed as `bun run optimize-images`)

Other scripts in `scripts/` are one-off refactors for portal workspace layout; run them directly with `node` only when you know you need them.

## 📝 Content Management (Sanity.io)

- Blog posts, gallery images, and related content are managed via [Sanity.io](https://www.sanity.io/).
- Sanity Studio lives in `citius-blog/`. From that directory, run `bun install` then `bun run dev` to open the Studio locally.

## 🤝 Contributing

1. Fork the repo and create your branch from `main`.
2. Run `bun install` and `bun run dev`.
3. Make your changes and test thoroughly (`bun test`, `bun run lint`).
4. Submit a pull request with a clear description.

## 🙋‍♂️ Need Help?
- For issues or questions, open an issue or contact the maintainers.
- For business inquiries, use the contact form on the website.

## 📚 Learn More
- [Next.js Documentation](https://nextjs.org/docs)
- [Sanity Documentation](https://www.sanity.io/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Convex Documentation](https://docs.convex.dev/)
- [Better Auth Convex Integration](https://www.better-auth.com/docs/integrations/convex)

## 🚀 Deploy

Deploy easily on [Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) or your preferred platform.

---

© Citius Holidays. All rights reserved. 
