# Plan 020: Add public Sacred Bharat Yatri Passports

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update only the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 95cb879..HEAD -- convex/schema.ts convex/sacredBharat.ts convex/lib src/app/sacred-bharat src/components/sacredBharat src/lib/sacredBharat src/data/sacredBharat`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `95cb879`, 2026-06-12

## Why this matters

Sacred Bharat currently has points, trails, badges, and a leaderboard, but the
social proof layer is thin. A public Yatri Passport lets people show where they
have been, share their trail progress, compare respectfully, and build a
personal travel identity without requiring a full browser game. This matches
the original gamification goal while staying feasible for the web.

## Current state

- `src/app/sacred-bharat/page.client.js:22` says visits are self-declared on an
  honor system.
- `src/app/sacred-bharat/page.client.js:54` renders the leaderboard section.
- `src/components/sacredBharat/LeaderboardTable.js:50` renders rank, yatri,
  temples, score, and title.
- `src/lib/sacredBharat/useSacredBharat.js:49` builds progress from server or
  guest state.
- `convex/sacredBharat.ts:226` builds leaderboard entries from visit rows.
- `convex/schema.ts:167` defines `userProfiles`; `177` has
  `sacredBharatLeaderboardOptOut`.
- `convex/schema.ts:967` defines `sacredBharatVisits` with only
  `authUserId`, `templeId`, and `visitedAt`.
- `src/data/sacredBharat/temples.js:5` contains temple city/state/region but no
  latitude/longitude.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Sacred Bharat tests | `bun test src/lib/sacredBharat/scoring.test.js convex/sacredBharat.test.ts` | exit 0 |
| Passport helper tests | `bun test src/lib/sacredBharat/yatriPassport.test.js convex/sacredBharatPassport.test.ts` | exit 0 |
| Convex API/schema | `bunx convex codegen` | exit 0 |
| Full tests | `bun test` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| React frontend check | `bunx react-doctor@latest --verbose` | no new Sacred Bharat findings introduced |

## Suggested executor toolkit

- Skills: `convex`, `build-web-apps:frontend-app-builder`,
  `build-web-apps:react-best-practices`, `build-web-apps:frontend-testing-debugging`,
  `react-doctor`, `motion` for restrained animated progress.
- Potential helper agents/tools: privacy reviewer, public-profile UX reviewer,
  Browser visual QA for `/sacred-bharat` and profile routes.
- Avoid image upload/proof moderation in this plan.

## Scope

**In scope**:
- `convex/schema.ts`
- `convex/sacredBharat.ts`
- `convex/sacredBharatPassport.test.ts` (create)
- `src/lib/sacredBharat/yatriPassport.js` (create)
- `src/lib/sacredBharat/yatriPassport.test.js` (create)
- `src/lib/sacredBharat/useSacredBharat.js`
- `src/app/sacred-bharat/yatris/[slug]/page.js` (create)
- `src/app/sacred-bharat/yatris/[slug]/page.client.js` (create)
- `src/components/sacredBharat/YatriPassportCard.js` (create)
- `src/components/sacredBharat/YatriRegionMap.js` (create)
- `src/components/sacredBharat/YatriShareCard.js` (create)
- `src/components/sacredBharat/LeaderboardTable.js`
- `src/app/sacred-bharat/page.client.js`

**Out of scope**:
- GPS check-ins.
- Proof/photo uploads and moderation.
- Real-time multiplayer/game mechanics.
- Changing the honor-system language.
- Booking-to-visit automation; this plan may add future-safe fields but should
  not auto-mark visits.

## Git workflow

- Branch: `codex/020-sacred-bharat-yatri-passport`
- Commit style: imperative prose.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add public passport profile data

In `convex/schema.ts`, add `sacredBharatProfiles`:

- `authUserId: v.string()`
- `slug: v.string()`
- `displayName: v.string()`
- `bio: v.optional(v.string())`
- `homeCity: v.optional(v.string())`
- `isPublic: v.boolean()`
- `shareWishlist: v.boolean()`
- `shareRecentVisits: v.boolean()`
- `createdAt: v.number()`
- `updatedAt: v.number()`

Indexes:

- `by_authUserId`
- `by_slug`
- `by_isPublic`

Extend `sacredBharatVisits` with optional future-safe fields:

- `visitedOn: v.optional(v.string())`
- `note: v.optional(v.string())`
- `source: v.optional(v.union(v.literal("self"), v.literal("citius_booking")))`
- `citiusBookingId: v.optional(v.id("bookings"))`

Default source should behave as `self` when absent. Do not require existing
visit rows to migrate immediately.

**Verify**:
`bunx convex codegen` -> exit 0.

### Step 2: Add profile and public passport APIs

In `convex/sacredBharat.ts`, add:

- `getMyPassportProfile`
- `upsertMyPassportProfile`
- `getPublicPassportBySlug`
- `getPassportSummaryForLeaderboard` if needed

Slug rules:

- Lowercase.
- Letters, numbers, and hyphens only.
- Unique.
- Reserved slugs: `leaderboard`, `trails`, `groups`, `challenges`, `admin`.

Privacy rules:

- Public passport route returns data only when `isPublic` is true.
- Leaderboard opt-out still removes the user from public ranking.
- A user may be public-profile visible but leaderboard opted out; show profile
  without rank in that case.
- `shareWishlist` and `shareRecentVisits` control those sections independently.

**Verify**:
`bun test convex/sacredBharatPassport.test.ts convex/sacredBharat.test.ts`
-> all tests pass.

### Step 3: Add passport summary helpers

Create `src/lib/sacredBharat/yatriPassport.js`.

Helpers:

- `buildRegionSummary(visitedTempleIds)`
- `buildTrailHighlights(progress)`
- `buildPassportShareText(profile, progress)`
- `buildPublicPassportStats(progress, leaderboardRank)`

Because temple data has no coordinates, build a region and state coverage map
instead of pretending to render a precise geographic map.

**Verify**:
`bun test src/lib/sacredBharat/yatriPassport.test.js src/lib/sacredBharat/scoring.test.js`
-> all tests pass.

### Step 4: Add the public profile route and components

Create `/sacred-bharat/yatris/[slug]`.

The profile should show:

- display name and title
- region coverage
- visited temple count
- trail badges
- completed trails
- recent visits if shared
- wishlist if shared
- leaderboard rank if not opted out
- share card/link

UI guidance:

- Use real Sacred Bharat data as the main visual signal, not generic hero art.
- Avoid dark blurred stock-like imagery.
- Keep the map as a clean region/stat visualization.
- Do not use a huge marketing hero. The passport itself should be first screen.

**Verify**:
Browser visual QA:
- Public passport route for a seeded profile.
- Private profile slug returns a respectful not-found/private state.
- Mobile: no table or card text overlaps.

### Step 5: Connect leaderboard and main page to passports

Update:

- `LeaderboardTable` so public users link to `/sacred-bharat/yatris/<slug>`.
- `/sacred-bharat` to show a compact "Your passport" card for signed-in users.
- `useSacredBharat` to expose profile/passport actions if that is the cleanest
  hook boundary.

Do not make profile creation mandatory for basic temple tracking.

**Verify**:
`bun test convex/sacredBharatPassport.test.ts src/lib/sacredBharat/yatriPassport.test.js`
-> all tests pass.

## Test plan

- Convex tests for profile create/update, slug uniqueness, privacy, leaderboard
  opt-out interaction, and public fetch behavior.
- Pure helper tests for region summary and share text.
- Existing guest merge tests must keep passing.
- Browser QA for public/private profiles and leaderboard links.

## Done criteria

- [ ] Signed-in users can create/update a public or private Yatri Passport.
- [ ] Public passport pages show visits, regions, trails, badges, and share UI.
- [ ] Leaderboard rows link to public passports when available.
- [ ] Honor-system visit language remains visible.
- [ ] No GPS/proof/photo upload mechanics are added.
- [ ] `bunx convex codegen` exits 0.
- [ ] `bun test` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- Implementing public profiles requires exposing email, phone, passport, or
  booking details.
- Temple data must have lat/long for a reasonable first-pass map.
- Slug uniqueness cannot be enforced without a risky migration.
- Leaderboard opt-out semantics become ambiguous.

## Maintenance notes

This creates the social identity layer for Plan 021. Reviewers should focus on
privacy defaults and public data shape. The profile must be useful even when a
user shares only trail/badge stats and hides recent visits or wishlist.
