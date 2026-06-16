# Plan 021: Add Sacred Bharat challenges and private groups

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update only the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 95cb879..HEAD -- convex/schema.ts convex/sacredBharat.ts src/app/sacred-bharat src/components/sacredBharat src/lib/sacredBharat src/data/sacredBharat`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/020-sacred-bharat-yatri-passport.md
- **Category**: direction
- **Planned at**: commit `95cb879`, 2026-06-12

## Why this matters

Sacred Bharat should incentivize travel through comparison, family progress,
and seasonal goals, not through a complex browser game loop. The existing trail
system is already a good scoring primitive. Challenges and private groups turn
that into social motivation: families, friend circles, pilgrimage groups, and
Citius-curated campaigns can compare progress without making every user compete
on the global leaderboard.

## Current state

- `src/data/sacredBharat/trails.js:5` defines 12 static spiritual trails with
  temple ids, bonuses, and badge ids.
- `src/lib/sacredBharat/scoring.js:92` computes trail progress and badges from
  visited temples.
- `src/components/sacredBharat/TrailCardGrid.js:15` renders public trail cards.
- `src/components/sacredBharat/FamilyComingSoon.js:5` is a placeholder for
  household progress.
- `src/lib/sacredBharat/useSacredBharat.js:96` already supports wishlist
  toggles for temple/trail goals.
- `convex/sacredBharat.ts:294` returns global leaderboard data with current-user
  rank.
- Plan 020 should add public Yatri Passport profiles and public slugs.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Challenge/group tests | `bun test src/lib/sacredBharat/challenges.test.js convex/sacredBharatChallenges.test.ts` | exit 0 |
| Existing Sacred Bharat tests | `bun test src/lib/sacredBharat/scoring.test.js convex/sacredBharat.test.ts convex/sacredBharatPassport.test.ts` | exit 0 |
| Convex API/schema | `bunx convex codegen` | exit 0 |
| Full tests | `bun test` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| React frontend check | `bunx react-doctor@latest --verbose` | no new Sacred Bharat findings introduced |

## Suggested executor toolkit

- Skills: `convex`, `build-web-apps:frontend-app-builder`,
  `build-web-apps:react-best-practices`, `build-web-apps:frontend-testing-debugging`,
  `react-doctor`, `motion`.
- Potential helper agents/tools: privacy/access reviewer, group-invitation
  reviewer, Browser visual QA for challenge and group pages.
- Do not use external game engines for this plan.

## Scope

**In scope**:
- `convex/schema.ts`
- `convex/sacredBharat.ts` or `convex/sacredBharatChallenges.ts` (create)
- `convex/sacredBharatChallenges.test.ts` (create)
- `src/data/sacredBharat/challenges.js` (create)
- `src/lib/sacredBharat/challenges.js` (create)
- `src/lib/sacredBharat/challenges.test.js` (create)
- `src/app/sacred-bharat/challenges/page.js` (create)
- `src/app/sacred-bharat/groups/[groupId]/page.js` (create)
- `src/components/sacredBharat/ChallengeGrid.js` (create)
- `src/components/sacredBharat/PrivateGroupPanel.js` (create)
- `src/components/sacredBharat/FamilyComingSoon.js`
- `src/app/sacred-bharat/page.client.js`

**Out of scope**:
- Real-time chat.
- GPS challenges.
- Proof uploads or photo moderation.
- Public group discovery.
- Rewards with monetary value.
- Booking-based automatic challenge completion; only include a future-safe
  "Citius booked" badge if Plan 020 added the source fields cleanly.

## Git workflow

- Branch: `codex/021-sacred-bharat-challenges-groups`
- Commit style: imperative prose.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Define challenge catalog and progress helpers

Create `src/data/sacredBharat/challenges.js` for fixed Citius-curated
challenges. Start with a small catalog:

- "Char Dham Prep"
- "Four Jyotirlingas"
- "Sacred Rivers"
- "South Temple Circuit"
- "First Five Darshans"
- "Bharat Explorer 2026"

Each challenge should include:

- `slug`
- `title`
- `description`
- `templeIds` or `trailSlugs`
- optional `startsOn` / `endsOn`
- `badgeId`
- `badgeName`
- `points`
- `visibility: "public"`

Create `src/lib/sacredBharat/challenges.js` with:

- `getChallengeProgress(challenge, progress)`
- `getChallengeBadgeAwards(progress)`
- `sortChallengesForUser(challenges, progress)`

**Verify**:
`bun test src/lib/sacredBharat/challenges.test.js src/lib/sacredBharat/scoring.test.js`
-> all tests pass.

### Step 2: Add private group schema and APIs

In `convex/schema.ts`, add:

`sacredBharatGroups`:

- `name: v.string()`
- `ownerAuthUserId: v.string()`
- `inviteCode: v.string()`
- `isArchived: v.boolean()`
- `createdAt: v.number()`
- `updatedAt: v.number()`

`sacredBharatGroupMembers`:

- `groupId: v.id("sacredBharatGroups")`
- `authUserId: v.string()`
- `role: v.union(v.literal("owner"), v.literal("member"))`
- `joinedAt: v.number()`

Indexes:

- group by owner and invite code
- members by group
- members by auth user
- unique-ish lookup by group/auth user

Create APIs:

- `createGroup`
- `joinGroupByInviteCode`
- `leaveGroup`
- `listMyGroups`
- `getGroupLeaderboard`
- `renameGroup` for owner only
- `archiveGroup` for owner only

Use Plan 020 passport public display names/slugs. For private groups, members
can see each other's display name, score, temple count, and badges even if they
are not on the global leaderboard, but do not expose email or phone.

**Verify**:
`bun test convex/sacredBharatChallenges.test.ts` -> all tests pass.
`bunx convex codegen` -> exit 0.

### Step 3: Add challenge and group UI

Add:

- `/sacred-bharat/challenges`
- challenge cards on `/sacred-bharat`
- replace `FamilyComingSoon` with a real `PrivateGroupPanel`
- `/sacred-bharat/groups/[groupId]`

UI requirements:

- Show progress bars, completed badges, and "next temple" suggestions.
- Group leaderboard should be compact and mobile-safe.
- Invite code should be copyable.
- Do not add public group discovery.
- Keep honor-system copy visible near visit actions.
- Keep the page primarily useful, not a marketing landing page.

**Verify**:
Browser visual QA:
- `/sacred-bharat/challenges`
- `/sacred-bharat`
- `/sacred-bharat/groups/<groupId>`
- Mobile width for challenge cards and group leaderboard.

### Step 4: Add optional "visited this year" and seasonal framing

If Plan 020 added `visitedOn`, use it to show:

- challenges completed this year
- "visited this year" counts
- seasonal challenge labels

If `visitedOn` did not land, skip this step and use `visitedAt` only for rough
recency. Do not block the plan on exact historical visit dates.

**Verify**:
`bun test src/lib/sacredBharat/challenges.test.js` -> includes date-based cases
when date fields exist.

### Step 5: Integrate with passports and leaderboard

Update public passport pages from Plan 020 to show completed challenges. Update
leaderboard entries or row detail to include challenge badge count only if the
data is already available without a large query penalty.

**Verify**:
`bun test convex/sacredBharatChallenges.test.ts convex/sacredBharatPassport.test.ts`
-> all tests pass.

## Test plan

- Pure challenge progress tests for temple-based, trail-based, seasonal, and
  complete/incomplete cases.
- Convex group tests for owner permissions, join by invite code, duplicate
  membership prevention, archive behavior, and private group leaderboard.
- Existing Sacred Bharat guest merge and scoring tests must keep passing.
- Browser QA for challenge and group pages.

## Done criteria

- [ ] Challenge catalog appears on Sacred Bharat and has accurate progress.
- [ ] Signed-in users can create, join, leave, and archive private groups.
- [ ] Group leaderboard compares only group members.
- [ ] Public passports show completed challenges.
- [ ] No public group discovery, GPS proof, or real-time chat is introduced.
- [ ] `bunx convex codegen` exits 0.
- [ ] `bun test` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- Plan 020 has not landed and there is no passport/profile identity layer.
- Group membership would expose emails, phones, booking data, or private profile
  fields.
- Invite codes cannot be made sufficiently random without adding a dependency.
- Challenge progress requires mutating visit rows in bulk.

## Maintenance notes

Private groups should stay lightweight. Future work can add Citius-booked stamps
or moderated photo memories, but those need a separate privacy and moderation
plan.
