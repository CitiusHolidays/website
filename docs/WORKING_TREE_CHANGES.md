# Working-tree change summary (historical bundle)

This document preserves the complete local working-tree bundle captured on 14 July 2026. It is an
archive of the earlier remediation and follow-up change set, not the current release status. The
current committed checkpoint, verification evidence, known debt, and external deployment blocker
are recorded in the current verification section below; `.scratch/README.md` is only a local,
gitignored mirror.

## Review bundles and dependencies

The working tree must be inventoried from both tracked and untracked state before any review bundle
is prepared:

```bash
git status --short
git diff --name-status
git diff --cached --name-status
git ls-files --others --exclude-standard
```

Those four views are the contract: a tracked deletion is never considered complete until its
replacement and every new dependency are visible in the same inventory. The current work divides
into five review bundles:

| Bundle | Includes | Depends on / must preserve |
| --- | --- | --- |
| Convex backend | CRM schema and functions, permissions, notifications, imports, pagination/search/aggregate workers, migrations, payment/auth data boundaries, and focused backend tests | Release tooling supplies clean code generation and Convex type checks. Public APIs remain compatible until their portal consumer lands. |
| Portal TypeScript migration | Portal workspace and table TypeScript successors, shared state/data/mutation boundaries, presentation contracts, mounted tests, and portal workflow documentation | Convex backend API compatibility. Deleted JavaScript entrypoints and TypeScript successors must land atomically. |
| AI runtime | Shared Next.js/Convex rate-limit and telemetry runtime, Concierge and Journey Planner routes/clients, provider policy, benchmarks, and AI tests | Convex backend runtime functions plus release-owned environment keys. Next.js and Convex copies of the shared secret must match when separately configured. |
| Public assets | Public and auth presentation, pilgrimage/Sacred Bharat content, hero/gallery media, responsive media policy, styles, and asset optimization | Release tooling proves deleted assets are absent from build output and required replacements are tracked. Portal visual rules remain out of scope. |
| Release tooling | Environment and release manifests, diff/lint checks, required CI, deployment command, package entry points, release documentation, and working-tree inventory | Lands first. It validates every later bundle but does not deploy, configure secrets, or change branch protection. |

When one file contains concerns from two bundles, split it only if both intermediate states still
build and preserve the public contract. Otherwise keep the file with the earlier dependency and
record the coupling in that bundle's review notes. Do not use partial staging to manufacture a
clean-looking bundle that omits a required untracked file.

The protected portal replacements are currently:

| Deleted entrypoint | Required successor |
| --- | --- |
| `PortalWorkspace.js` | `PortalWorkspace.tsx` |
| `SelectableDataTable.js` | `SelectableDataTable.tsx` |

The machine-readable atomic replacement manifest is enforced by `bun run diff:check` locally and
by required CI. An unrelated deletion or rename remains allowed; a protected deletion or rename to
the wrong destination fails with both the deleted path and expected successor in the message.

## What changed for customers

### Public site and hero media

- The home hero again fills the first viewport (`h-screen min-h-[700px]`) so the next section does
  not appear until the visitor scrolls.
- The original optimized desktop and mobile MP4/WebM files are used. The grainy second-generation
  ffmpeg encodes were removed.
- The still poster remains visible while video loads. Video sources mount only near the viewport,
  use `preload="none"`, and stay disabled for reduced-motion, data-saver, and 2G users.
- The unused 94 MiB source file `public/Main Website vdo.mp4` was removed from the deploy surface.
- Public and authentication layouts received mobile, reduced-motion, safe-area, focus, and contrast
  corrections. Sacred Bharat and Pilgrimage controls remain reachable at narrow and landscape
  sizes.

### Citius Concierge and Journey Planner

- Both AI routes now use explicit OpenRouter free-model fallback policies with no SDK retries.
- Concierge prioritizes `google/gemma-4-31b-it:free`, then
  `nvidia/nemotron-3-super-120b-a12b:free`, then
  `nvidia/nemotron-3-ultra-550b-a55b:free`. This order favors a responsive tool-capable model and
  retains stronger fallbacks.
- Journey Planner prioritizes Nemotron 3 Ultra, then Nemotron 3 Super, then Gemma 4 31B because its
  task favors itinerary quality over tool-call speed.
- Concierge is capped at 800 output tokens and four steps. Journey Planner is capped at 900 output
  tokens and one step. Each provider gets at most 18 seconds inside a 45-second generation budget,
  leaving 15 seconds of route headroom.
- Streaming now has stable structured events, cancellation and disconnect handling, interrupted
  terminal states, safe formatting, bounded request sizes, and stable user-facing errors.
- Shared rate limits and privacy-safe telemetry are backed by Convex. Local development falls back
  to a process-local hashed rate limiter when shared runtime configuration is absent; production
  remains fail-closed.
- The UIs warn users not to submit passport, payment, or other sensitive personal information to
  free third-party model endpoints.

## What changed for staff in Citius Connect

### Navigation, lists, and visual consistency

- The portal workspace and its hot data paths moved to typed TSX boundaries with shared typed grid,
  workflow-presentation, and route-dependency contracts.
- Important sales actions stay visible. Secondary query actions use an anchored, keyboard-accessible
  **More** dropdown instead of a modal.
- Traveller, Ticketing, Flights, Hotel/Rooming, Passport, and Visa keep their primary create action
  visible and place secondary import/export actions under the toolbar **More** dropdown.
- Shared tables paginate 25 loaded rows at a time. Page changes preserve cross-page selection,
  visible-page select-all remains scoped to that page, filtered row replacement resets to page 1,
  and loading another server cursor page preserves the current page.
- Filters and active tabs restore from URLs and deep links. Lists expose bounded server search and
  cursor loading instead of growing the page without limit.
- Finance, Ticketing, dashboard, and other metric cards now use fluid, consistent layouts. Legacy
  fixed-width card styling was removed.
- Non-query entity forms use the same sectioned hierarchy as the current Sales Query form.
- The signed-in Google profile image is shown in the CRM header with the existing user icon as a
  fallback.
- The existing footer/contact texture (`/gallery/bgfooter.webp`) appears subtly behind the CRM shell
  to reduce blank white surfaces. The current checkpoint additionally scopes a premium CRM palette
  and heading treatment to `.portal-shell`; public and customer-account tokens remain unchanged.
- Portal tabs, confirmation dialogs, toast stacking, focus handling, mobile target sizes, safe areas,
  and reduced-motion behavior were tightened and covered by mounted tests.

### Sales, contracting, and ticketing workflows

- Query presentation uses the canonical `With Sales` handoff and Sales Decision flow. Contracting
  sends costing through **Send to Sales**; Sales confirms, requests revision, or marks an order lost.
- Contracting owner labels read **Contracting SPOC** while existing database field names remain
  unchanged.
- Query assignment keeps separate Contracting SPOC and Ticketing Scope/SPOC semantics and mirrors
  owners onto linked job cards.
- Assignment email is now sent only to the staff members selected as Contracting or Ticketing SPOCs.
  Department heads can still receive oversight bell notifications, but those role notifications no
  longer expand into department-wide or email-alert-role email fanout.
- Proposal, Contracting, Ticketing, Job Card, and invoice lists share canonical attention and status
  presentation. Pipeline tabs are keyboard-accessible.

### Operations, imports, and scale

- Passport metadata, content, replacement, and deletion are authorized by Job Card scope.
- Traveller, passport, visa, ticketing, rooming, and related lists retain Job Card and Travel Batch
  scope. Travel Batch ordering is numeric across B99/B100/B101, and creation counters are
  transactional.
- Spreadsheet uploads keep the no-total-row-cap contract while processing idempotent batches with a
  concurrency limit of three. Workbook code is lazy-loaded only when requested.
- Search projections and monthly/day/rooming aggregates carry version and generation readiness so a
  stale repair cannot publish incomplete data as current.
- Passport expiry is denormalized for bounded list reads, and the backfill itself is cursor-bounded.
- Notification cleanup, bulk deletion, Job Card descendant cleanup, Traveller cleanup, and PNR
  cleanup use bounded server-side work. The UI can keep an unlimited selection while issuing safe
  32-item mutation chunks.

## Security and data integrity

- Expense approvals now bind to versioned approval snapshots and proof digests. Creator access and
  finance/manage-all oversight are explicit.
- Booking payment transitions are private, terminal-safe, provider-event idempotent, and protect
  inventory from double application.
- Auth proxying validates trusted origins and forwards only the required credentials.
- Maintenance migrations and capability inventory endpoints require explicit authorization.
- Portal files continue through authenticated same-origin routes instead of exposing raw storage
  URLs.
- Public Portable Text links are restricted to relative, HTTP(S), mailto, and tel destinations;
  unsafe CMS schemes render as inert text in both post bodies and author bios.
- The chat, Journey Planner, contact, and inbound-intent JSON endpoints enforce streamed byte
  limits and reject malformed or non-object bodies before downstream validation or provider work.
- The missing-profile path has a deterministic fallback, and the `ws` dependency is overridden to
  8.21.0.

## Release and engineering controls

- `config/environment.manifest.json` is the canonical key-only environment inventory, with
  `.env.example` kept value-free.
- The locked Required Quality workflow described by this historical snapshot was later retired
  because its repository variables and non-production Convex credential were never configured.
  The same checks remain available as explicit local and deployment-target-aware commands.
- `config/release/release-contract.json`, `vercel.json`, and `RELEASE.md` protect and explain the
  Convex-aware Vercel build command, preview/production key separation, activation, and rollback.
- The lint ratchet blocks per-rule regressions while the older all-files lint backlog is burned down.
- React Compiler opt-outs were removed from active portal paths, stable boundaries were extracted,
  and React Doctor reports a clean result.

## Repository cleanup

- `.gitignore` now targets generated output, credentials, editor state, local evidence, and media
  staging inputs without hiding repository-owned `docs/`, `scripts/`, `bin/`, `.agents/`, or
  `.claude/` source.
- The corrected rules expose the AI benchmark, migration/architecture documentation, `AGENTS.md`,
  and the Next.js development skill to Git instead of silently leaving them ignored.
- The obsolete one-use dashboard patch script and its embedded legacy `PortalWorkspace.js` snippet
  were removed after the workspace moved to `PortalWorkspace.tsx` and extracted dashboard modules.
- Unreferenced default Next.js starter icons were removed. The actively used `noise.svg` remains.
- Two byte-identical public assets were consolidated: all logo rendering now uses the existing
  statically imported logo, and the duplicate Kora gallery entry points to the retained Kora image.
- The hero re-encoding command and PowerShell script were removed to prevent the restored optimized
  media from being accidentally recompressed again.
- Finder metadata and the generated TypeScript build-info cache were removed locally.

## Current verification snapshot (5 August 2026)

The post-MP4 remediation checkpoint completed the following local gates:

| Gate | Result |
| --- | --- |
| `bun run test` | 1,236 passed, 0 failed with 5,771 expectations across 262 files; every test file runs in an isolated global/JSDOM context |
| `bun run typecheck` | Passed |
| `bun run convex:typecheck` | Passed |
| Fresh `bunx convex codegen --typecheck enable` | Passed against the configured development deployment; no production deployment was run |
| Focused integrated regression suite | 273 security, authorization, lifecycle, migration, payment, storage, browser, and workflow tests passed |
| Final-review security/data-integrity suite | 57 shared-rate-limit, cleanup, storage-reference, expense-authority, and file-response tests passed |
| `bun run build` | Passed with Next.js 16.3.0; 86 static pages generated; no deployment was run |
| `bun run config:check` / `policy:check` / `assets:check` / `performance:check` | Passed |
| Preview and production environment-contract preflight | Passed with safe `.invalid` placeholders and all E2E provisioning values disabled |
| `DIFF_BASE=696d066 bun run diff:check` | Passed for the full post-MP4 range |
| `bun run lint` | Passed with 0 errors; 1,867 acknowledged legacy warnings were reported |
| `bun run lint:ratchet` | Passed at 0 errors / 1,865 warnings, exactly at the checked-in debt ceiling |
| `bun audit --audit-level=high` | Passed with no high or critical advisories in the application workspace |
| `(cd citius-blog && bun install --frozen-lockfile && bun run build && bun audit --audit-level=high)` | Passed on Sanity 6.9.0 with Node 22.12+; the static Studio build succeeded and no high or critical advisories remain; no deployment was run |
| Authenticated local `/portal` browser evidence | Dashboard to All Sales Queries presented pending feedback in about 3 ms, route readiness in about 105 ms, and the first real row in about 404 ms |
| Local command-palette focus evidence | Search received focus on open; Escape closed the dialog and restored focus to the exact trigger |
| Live production `/portal` | Still pending authorized deployment/cache activation and production browser verification |

## Historical verification snapshot (14 July 2026)

The final local pass completed with:

| Gate | Result |
| --- | --- |
| `bun test` | 625 passed, 0 failed |
| `bun run typecheck` | Passed |
| `bunx convex codegen` | Passed |
| `bun run convex:typecheck` | Passed |
| `bun run lint:ratchet` | Passed at 17 errors / 1,664 warnings, below the legacy baseline |
| `bun run config:check` | 7 passed, 0 failed |
| `bun run diff:check` | Passed |
| `react-doctor --verbose` | 100 / 100, no issues |
| `bun run build` | Passed; 84 pages generated |

Signed-in browser checks covered the dashboard, Queries, Proposals, Hotel/Rooming, Ticket Dashboard,
Passport Documents, Finance, Expenses, Approvals, Google avatar, More menus, table pagination, and a
non-submitted sectioned Traveller form. The original hero assets and full-viewport layout were also
checked in the live browser. A raw Concierge tool-call probe completed in 2.593 seconds, and a
browser retry returned a context-grounded MICE answer.

## Historical activation notes (14 July 2026 snapshot)

- Restricted-role deny paths still need separate non-production accounts. The available browser
  identity has broad Admin plus departmental roles and cannot prove those denials.
- A real SPOC assignment was not submitted because it would mutate shared data and send mail. The
  corrected recipient behavior is covered by focused Convex tests.
- GitHub branch protection, Vercel environment ownership, Convex deploy-key scope, backup settings,
  and production provider configuration still require explicit external inspection and authority.
- The archived 14 July snapshot reported four moderate transitive advisories. The application and
  separately versioned `citius-blog` Studio workspaces are now both clear at the high/critical
  audit threshold.
- Free OpenRouter endpoints can be capacity constrained, so transient model failures remain possible.

## Related documentation

- [Portal CRM workflows](PORTAL_CRM_WORKFLOWS.md)
- [Portal roles and access](PORTAL_ROLES_AND_ACCESS.md)
- [Portal permissions architecture](PORTAL_PERMISSIONS_ARCHITECTURE.md)
- [Release operations](../RELEASE.md)
- Local evidence pack: the dated scratch bundle was intentionally removed after reconciliation;
  the current verification section above is the durable summary.
