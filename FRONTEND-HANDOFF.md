# Frontend handoff

Running record for frontend-aio passes. One section per task; see
`~/.agents/skills/frontend-aio/references/context-and-findings.md` for the format.

## Task: Office check-in (2026-11-05)

### Brief

- **Outcome.** A new Staff Workspace view, `/portal/office-check-in`, titled "Office check-in". Staff
  see their office and its verification rule, press Clock in / Clock out, and see today's times and
  a per-signal result (pass, fail, uncertain) with plain-language reasons. Managers see who checked
  in on a date with verification status and can review or correct a record with an audited reason,
  or add a manual entry for someone with no record. Admins (exact Admin or `manage:staff`)
  configure each office's rule, create offices, assign staff to offices, see unmatched networks seen
  during the pilot and the recent audit.
- **Audience and frequency.** Every staff role, twice a day (clock in, clock out), on desktop or
  phone. Managers glance daily. Admins configure rarely.
- **Screen's one question.** "Am I checked in today, and did my check pass?" for staff; "Who is in
  the office today and whose check needs a look?" for managers.
- **Constraints.**
  - Report-only pilot: a result is evidence, never proof. Copy never claims that an IP or GPS
    reading proves presence. Nothing is blocked in report-only mode; in Enforce mode a failed or
    uncertain check waits for manager review.
  - Location is requested only on the Clock in / Clock out press, only when the office rule needs
    it, and a one-line notice says why before the browser prompt. Denied, timeout, unavailable and
    unsupported each get plain copy and the reading is still submitted.
  - Clock in/out goes through `POST /api/portal/office-check-in` (`src/lib/officeCheckIn/contracts.ts`).
    The browser never sends an IP.
  - Staff Workspace and Customer Account stay distinct; existing screens are not redesigned.
    Existing tokens, `Panel`, `Badge`, `SelectableDataTable`, `ControlledDialog`,
    `PortalDateInput`, `Select`, `usePortalConfirm`, `usePortalToast` are reused.
  - Dates DD/MM/YYYY; times in the office time zone.
  - Gate: `request:leave` (added to every staff role by `getRolePermissions`); no new permission
    strings. Admin section: `isExactAdmin(access)` or `manage:staff` (matches the
    `officeCheckInAdmin` server gate).
  - Write scope: `src/**`, `e2e/registry/portalViews.ts`, `tools/portal-role-pages-expected.json`,
    this file. Convex, API routes, gateway, env manifests belong to other workers.
- **Prioritised flows.** (1) Clock in with and without location, including every geolocation
  failure; (2) clock out; (3) manager review/correct/manual entry with reason; (4) admin rule edit
  with Enforce confirmation; (5) office create and staff assignment.
- **Verification targets.** Mounted tests: location only when needed and no `ip` in the body;
  permission denied copy plus submission; manager table statuses; review requires a reason; Enforce
  needs confirmation. Route manifest count, nav icon parity, role-page fixture, TypeScript, Ultracite,
  React Doctor. Rendered review needs an authenticated portal and a Convex deployment, which this
  worker must not start: pass 9 rendered checks stay open for the coordinator.
- **Aspects in scope.** Passes 1–10 all apply: new screen with layout, type/colour/icons,
  accessibility, writing, and a deliberate no-new-motion decision.
- **Source revision.** Base `cbe4bc74` plus uncommitted working tree (backend files untracked).

### Accepted direction

- **Composition.** One portal view inside the existing workspace shell, no hero. Stacked `Panel`s in
  order of authority: **My day** (first, widest; answers the screen's question), **Today in the
  office** (only when `myStatus.canOversee` or `teamDay` returns rows), **Office rules** (admin only).
  My day is a two-column panel at `lg` (status + action left, today's record and per-signal result
  right) that stacks on phones. The team table uses `SelectableDataTable` (non-selectable) with a
  text summary line of counts computed from rows, not KPI tiles. Admin uses a two-column split at
  `xl` (office list left, selected office's rule editor right) with assignment, unmatched networks
  and audit below. Reason: app-screens §2.2 (largest block carries the question), §5/§13 (KPIs are
  type, no icon tiles), §7 (tables are rules and alignment), §8.2 (one save model per panel);
  reference: `LeaveView`, `InboundLeadsView`, `OperationalControlsPanel`.
- **Type.** Existing roles only: `font-heading` for panel titles (`Panel` default text-sm, My day
  status line text-lg), Inter body text-sm, grey `text-brand-muted` text-xs for meta. No eyebrow
  labels (DESIGN.md). `tabular-nums` on every time, date and count.
- **Colour and icons.** Existing tokens. One filled primary per view: the Clock in / Clock out button
  (`portal-primary-btn`, citius-blue). Outcome and status use existing `Badge` tones with the word
  always present (Pass/Fail/Uncertain; Checked in/Checked out/Not checked in/Awaiting review/
  Rejected), so colour is never the only cue. Lucide outline icons 16px, grey, only where they help
  (signal rows, nav). Nav icon `ClockCheck`.
- **Motion stance.** No new motion. Clock in is a twice-daily task action whose feedback is the
  label change, `aria-busy` and the live status line; panels and dialogs mount without added
  animation (portal dialog precedent; TRANSITION_POLICY). Existing button transitions stay.
- **Defaults.** Press scale 0.96 (existing `.portal-*-btn:active`), easing `var(--portal-ease-out)`
  at 120–160ms (existing), no new durations. Targets: primary 44px (`portal-primary-btn`), row
  actions 40px (`portal-small-btn`), inputs 44px (`portal-input`, `PortalDateInput`). Dialogs:
  `ControlledDialog` with `PORTAL_Z.entityModal`, confirm via `usePortalConfirm` (above modals).

### Pass 0: Brief and contract (2026-11-05)

- Skills: none (frontend-aio `references/context-and-findings.md`, `skill-sets.md`, `routing.md` §1).
- Scope: new view only; registration touch points `portalRouteManifest.ts`, `constants.js`
  (`PORTAL_NAV_GROUPS`), `portalNavIconMap.ts`, `portalLazyViews.tsx`, `portalRouteLifecycle.tsx`,
  `PortalWorkspaceHeader.tsx` (self-owned controls, no generic toolbar), tests and fixtures.
- Findings: `src/components/portal/workspace/portalViewTypes.ts` | self-fetching views
  (`InboundLeadsView`, `EventPhotoBoothView`) declare their own props there is no shared props type to
  add | none | accepted (props declared in the view).
- Findings: `convex/crm/officeCheckIns.ts` `myStatus.canOversee` uses `isOverseer` (all-office or
  `view:team`), while `teamDay` also returns direct reports | a line manager without `view:team`
  only sees the section if `teamDay` returns rows | the view queries `teamDay` for every user | implemented.
- Decisions: path is "specific request" (new screen inside an accepted shell) | brief.
- Remaining checks: rendered review on an authenticated portal | pass 9 (coordinator).

### Pass 1: Inspiration (2026-11-05)

- Skills: `design-taste-frontend` direction library (`~/.agents/skills/design-taste-frontend/SKILL.md`)
  not run: `draw.mjs --app` deals a new style and the brief keeps existing tokens; `research` is
  gated (background agent, writes a file) and was not run.
- Scope: references answer "how does this workspace already show a personal panel, a review table,
  a reasoned admin edit?"
- References (observed in source): `admin/LeaveView.tsx` (personal balances panel above a review
  table, `SelectableDataTable` columns, `StatusBadge`), `InboundLeadsView.jsx` (self-fetching view,
  inline `role="status"` result, filter row of labelled controls), `settings/OperationalControlsPanel.tsx`
  (admin-only badge, reason-required apply, `formatConvexError`), `SaveViewDialog.js` /
  `PassportUploadModal.tsx` (`ControlledDialog` form dialogs), `PortalConfirmDialog.js` (confirm).
- Decisions: reuse these patterns; no external references needed | brief keeps the Staff Workspace
  baseline.

### Pass 2: Taste and design direction (2026-11-05)

- Skills: `design-taste-frontend` app-screen run (`~/.agents/skills/design-taste-frontend/references/app-screens.md`
  §2.1–2.2, §7, §8, §11, §13 read); `emil-design-eng`, `apple-design`, `make-interfaces-feel-better`
  headings only (no conflicts with the existing press/ease tokens); `frontend-design:frontend-design`
  is Claude-plugin only and not loaded in this worker. `draw.mjs`/`inspect.mjs` need a reachable URL
  and were not run (no live portal).
- Scope: whole new view.
- Findings: my-day panel | screen question needs the largest block | first panel, two columns |
  implemented. Team summary | KPI tiles with icons would be a template tell (§13) | text summary
  computed from rows | implemented. Team table | must not be zebra/uppercase headers | reuse
  `SelectableDataTable` house table (existing header style kept: house baseline outranks the study) |
  accepted. Rule editor | one save model per panel (§8.2) | single "Save rule" with reason at the
  panel's bottom | implemented. Empty and error states (§11) | keep frame, one sentence, retry where
  it applies | implemented.
- Decisions: Accepted direction above | app-screens §2.2, §7, §8.2, §11, §13 and the house baseline.
- Remaining checks: `inspect.mjs <url> --app` on the rendered view | pass 9 (coordinator).

### Pass 3: Layout and structure (2026-11-05)

- Skills: `better-layout` (`~/.agents/skills/better-layout/SKILL.md`; grouping, one primary action,
  "Before you finish"); `good-css` headings; `break-ui` gated (renders a demo toggle) and not run.
- Scope: three panels, filter row, table, dialogs, admin split.
- Findings: grid tracks with long office/label text | overflow risk | `minmax(0,1fr)` tracks and
  `min-w-0` on flex children | implemented. Filter row (date, office) | must wrap on phones |
  `flex-wrap` with labelled controls | implemented. Network range rows | many columns on phones |
  stack to one column below `md` | implemented. One primary action per view | Clock in/out only
  filled button; admin save uses `portal-primary-btn` inside its own panel | decision: admin panel is
  a separate, permission-gated area, so it keeps its own primary save.
- Decisions: logical spacing utilities (`gap`, `ms/me`, `ps/pe`) only | mirroring-safe.
- Remaining checks: 390px and 1440px rendered layout, long names | pass 9 (coordinator).

### Pass 4: Typography, colour and icons (2026-11-05)

- Skills: `better-typography` (Before you finish table), `better-colors` (match the project system,
  one meaning per colour); `oklch-skill` not needed (no new colours).
- Scope: all new text and badges.
- Findings: times and counts | jitter in columns | `tabular-nums` | implemented. Outcome colour |
  green/red/amber `Badge` tones already exist; each badge carries the word | implemented. Range
  strings | use en dash for time ranges ("09:12–18:03") | implemented. No new hex/oklch literals |
  implemented.
- Decisions: no font, size or token changes | DESIGN.md typography constraints.
- Remaining checks: rendered contrast of `text-brand-muted` on white at text-xs | pass 9.

### Pass 5: Accessibility (WCAG 2.2 AA) (2026-11-05)

- Skills: `better-accessibility` (`SKILL.md`, `forms.md`); `fixing-accessibility` headings.
- Scope: clock button, live region, filters, table actions, dialogs, admin forms.
- Findings:
  - Clock button busy state | 4.1.2 state | `aria-busy`, label "Checking…", disabled while pending
    so a double press cannot post twice | implemented.
  - Result announcements | 4.1.3 | one persistent `role="status" aria-live="polite"` region in My
    day; errors use `role="alert"` | implemented.
  - Dialog reason | 3.3.1/3.3.2 | visible label, validate on submit (not by disabling submit),
    `aria-invalid` + `aria-describedby`, focus the field | implemented.
  - Dialog focus | 2.4.3 | `ControlledDialog` traps and restores focus; initial focus on the first
    field | implemented.
  - Status colour | 1.4.1 | every badge has its word | implemented.
  - Targets | 2.5.8 | 40–44px controls | implemented.
  - `Badge` primitive sets `role="status"` on every badge (`portalWorkspaceListUi.tsx:47`), so a
    reactive table re-render can announce badge changes | existing shared primitive, not changed
    here | open, owner: shared component follow-up (outside this task).
  - Reduced motion | 2.3.3 (AAA) / house policy | no new motion; spinner is the existing
    `animate-spin` collapsed by the global reduced-motion rule | accepted.
- Remaining checks: keyboard and screen-reader walk on the rendered view | pass 9 (coordinator).

### Pass 6: Writing (2026-11-05)

- Skills: `better-writing` (`SKILL.md`); `design:ux-copy` is Claude-plugin only, not loaded.
- Scope: every new string.
- Inventory: existing nouns "Office" (staff office field), "Staff", "Reason", buttons "Save", "Cancel",
  "Request Leave"; sentence case on buttons in newer views ("Save current view").
- Findings: verdict language | must not imply proof | outcome words are "Pass", "Fail", "Uncertain";
  pilot note: "Results are recorded for review. Nothing is blocked during the pilot." Enforce note:
  "If a check does not pass, a manager reviews it before it counts." | implemented. Rule in plain
  words | e.g. "This office checks the office network and your location." | implemented. Geolocation
  errors | say what happened and that the check-in was still recorded | implemented. Dialog titles
  name action and person ("Review Asha Rao's check-in") | implemented. Buttons verb-first ("Clock in",
  "Save rule", "Add office", "Record entry") | implemented. Requirement select | explicit wording that
  the employee cannot choose an easier method | implemented. Inputs start empty with documentation
  placeholders (`203.0.113.0/24`, `2001:db8::/48`) | implemented.
- Remaining checks: product review of wording | coordinator.

### Pass 7: Interaction and motion (2026-11-05)

- Skills: `animate` (`SKILL.md` Hard Rules, Build Sequence steps 1, 2, 6, 7; opener skipped).
- Scope: clock button, dialogs, Enforce confirmation.
- Findings: Clock in/out runs twice a day but is a task-completion action, and the useful feedback is
  state, not motion (step 1–2: purpose = feedback, satisfied by label/status change) | no animation |
  decision. Dialogs | portal confirm/command dialogs mount without open animation by policy | no
  added animation | decision. Rapid repeat | button disabled while pending; dialog submit disabled
  while saving | implemented.
- Decisions: zero new motion code | `animate` step 1 and `docs/TRANSITION_POLICY.md`.
- Remaining checks: none beyond pass 9 reduced-motion spot check.

### Pass 8: Implement (2026-11-05)

- Skills: `vercel-react-best-practices` (headings: client data fetching, re-render hygiene), `tdd`
  (mounted regression tests in the repo's `bun:test` + JSDOM convention); `shadcn` not applicable (no
  `components.json` usage here).
- Scope and files:
  - New: `src/app/portal/office-check-in/page.js`; `src/lib/officeCheckIn/location.ts`
    (`readLocation`), `presentation.ts` (copy, statuses, office-time helpers), `submit.ts` (POST to
    the route, body = action + location only); `src/components/portal/workspace/officeCheckIn/`
    (`OfficeCheckInView`, `MyDayPanel`, `TeamDayPanel`, `TeamRecordDialogs`, `OfficeRulesAdmin`,
    `OfficeRuleEditor`, `OfficeCheckInParts`, `officeCheckInTypes`, test harness, two mounted tests);
    `src/lib/officeCheckIn/officeCheckInClient.test.js`.
  - Registration: `portalRouteManifest.ts` (permission `request:leave`, family administration),
    `constants.js` nav item (Admin group, after Employees on Leave), `portalNavIconMap.ts`
    (`ClockCheck`), `portalLazyViews.tsx`, `portalRouteLifecycle.tsx`, `PortalWorkspaceHeader.tsx`
    (view owns its controls), route count 26 → 27, `permissions.test.js` (every role reaches the
    page), `tools/portal-role-pages-expected.json` (every role), `e2e/registry/portalViews.ts`
    (planned cells: clockIn/sales, review/hr, configureRule/admin; none marked covered).
- Findings:
  - Clock in/out: location read only inside the press handler and only when
    `myStatus.rule.needsLocation`; otherwise `{kind:"not_requested"}`; one-line notice shown before
    the press; ref guard blocks a double post | implemented, mounted-tested.
  - `myStatus` reference time is quantised to 5 minutes so the subscription is not re-opened every
    30-second tick | implemented.
  - Review/Correct/Add entry share one `ControlledDialog` host; every save needs a 3–500 character
    reason validated on submit; dialogs stay on the live row | implemented, mounted-tested.
  - Rule editor: empty for a new office; documentation placeholders (`203.0.113.0/24`,
    `2001:db8::/48`, `0.000000`); client validation reuses `validateBranchRule`; turning on Enforce
    goes through `usePortalConfirm`; `expectedVersion` guards concurrent edits; editor remounts on
    a new version | implemented, mounted-tested.
  - Times shown in the office zone: `myStatus.timeZone` for My day; per-office zone from the admin
    overview when available, else the viewer's office zone, for team rows | implemented with a
    backend gap (below).
- Backend contract gaps (reported, Convex not edited):
  1. `teamDay` rows carry no office time zone, so a manager without `manage:staff` sees other
     offices' times, and enters corrections, in their own office's zone. The server rejects a time
     outside the record's work date, so this fails safe but can mislead. Proposed: add `timeZone`
     per row (or per office in `offices`).
  2. `teamDay` returns `offices` derived from the filtered rows for scoped managers, so selecting
     one office collapses the office filter to that office until "All offices" is chosen.
  3. The UI must call `teamDay` for every staff user to find line managers without `view:team`
     (scan of up to 1,000 staff per page view). Proposed: `myStatus` returns `hasReports` (or
     `canOversee` includes direct reports) so the view can skip `teamDay`.
  4. No query for a person's own history list beyond today; not needed for this brief.
- Remaining checks: none in code; rendered checks in pass 9.

### Pass 9: Verify the final source (2026-11-05)

- Skills: project automated tests; `verify-this` approach (claims checked against fresh command
  output); `control-ui` (temporary local Playwright harness), `better-accessibility` (keyboard
  walk, focus, live regions, reflow, contrast). `inspect.mjs --app` not run.
- Source revision: base `cbe4bc74` + uncommitted working tree, including the pass 9 repairs
  below.
- Code-level evidence (first run, before rendering): 8 acceptance files 82 pass; portal-wide 669
  pass; `tsc` exit 0; Ultracite and anti-slop clean on changed files; `lint:ratchet` fails only on
  `contracts.ts` (`noNestedTernary`, `useDestructuring`; another worker's file); knip
  `contracts.ts: isLocationReading` unused; React Doctor only `socket/low-supply-chain-score` on
  `package.json:105,110` (user's change).

#### Rendered verification (fixture, 2026-11-05)

- **Method.** I added a temporary dev-only route, `src/app/office-check-in-fixture/`
  (`NODE_ENV=production` returned `notFound()`). It rendered the real `OfficeCheckInView` inside
  `PortalToastProvider`, `PortalConfirmProvider`, the motion providers and the `portal-shell`
  wrapper. Data came from a fake `ConvexProvider` client (`watchQuery`/`mutation`) serving
  synthetic fixtures for these scenarios: staff-location, staff-network, staff-clocked-in
  (Fail/Uncertain), enforce-pending, manager (8 rows, including a long name and long office, a
  manager entry, Rejected, and a row the manager can't review), admin (3 offices, unmatched
  networks, audit) and no-office. `fetch` to `/api/portal/office-check-in` was stubbed in-page.
  It ran on `next dev --port 3418` (Next only) and was driven by the repo's Playwright 1.64. The
  route was deleted afterwards; `git status --short src/app` shows no fixture file.
- **Evidence.** Scripts, JSON results and 68 screenshots are in `/private/tmp/claude-502/-Users-sharm1-Downloads-projects-citius-travel-website/3178dbb2-bff9-41ac-a7e1-8a314524c14d/scratchpad/checkin-verify/` (`shots/`,
  `chromium-checks.json`, `webkit-checks.json`). This is fixture evidence only. It does not
  cover a live backend, auth, real devices or real office networks.
- **Engines.** Chromium 156 and WebKit (Playwright 2370), each at 1440×900 and 390×844, plus
  reflow at 720 (200% of 1440), 320, 1024 and 1280. **Firefox 157 (Playwright 1555) was not
  verified**: the binary exits at launch with "Could not find profile folder", including when
  run directly and outside the sandbox.
- **Observed passing (both engines, both widths unless noted):**
  - Hierarchy and layout. My day comes first, with the status badge beside its title and a
    two-column layout at `lg` that stacks on phones. Team rows switch to mobile cards. No page
    horizontal scroll, and no panel wider than `#portal-main`'s content box, at
    320/390/720/1024/1280/1440.
  - Keyboard. Tab reaches Clock in with a visible 2px outline. WebKit needs Option+Tab, which is
    Safari's default for buttons.
  - Enter and Space press the button. The POST body has exactly `action` and `location`, with no
    `ip`. The location kind is right for each case: position (WebKit, real API with
    `geolocation` granted), permission_denied, timeout, the never-answering case after the 30 s
    watchdog, and not_requested when the rule is network-only.
  - The polite live region exists empty before the press, then reads "Clock-in recorded." with
    the matching location copy. A route refusal renders `role="alert"` in `main`.
  - Focus stays on the button through busy and its relabel to Clock out.
  - Row actions show a focus ring and have names that contain the visible label. The office
    `Select` opens and selects by keyboard. The date input shows a ring.
  - Review dialog: initial focus is on the first field. An empty submit focuses Decision and
    shows both linked errors.
  - Admin: an arrow key selects Enforce. Save rule opens the confirm on top (`elementFromPoint`)
    with focus on Cancel. Escape cancels with no mutation and returns focus to Save rule.
  - Reduced motion collapses the spinner animation and button transitions to 0.001s.
  - `text-brand-muted` text-xs on white measures 4.75:1, which passes.
- **Header (observed, `curl -I`).** `/portal` and `/portal/office-check-in` send
  `geolocation=(self)`; `/` and the fixture path send `geolocation=()`. With permission
  granted, Chromium still returns permission_denied on the fixture path, so the `/portal` rule is
  required for real readings. A real-API grant could only be shown in WebKit, because rewriting
  the header in Playwright broke hydration.
- **Defects found and fixed:**
  1. `OfficeRulesAdmin.tsx`: at `xl`, the office list (363 px) and the Add office inputs
     overlapped the rule editor (288 px track). At 390 the panel rendered 430 px wide and was
     clipped by the shell, cutting off Save rule and Remove. Cause: implicit `auto` grid tracks
     sized to the `truncate` name and input min-content. Fix: explicit
     `grid-cols-[minmax(0,1fr)]` on the admin root, split, left column and list, and on the
     `OfficeCheckInView` root.
  2. `OfficeRulesAdmin.tsx`: grey meta text on the selected office (`bg-citius-blue/5`) measured
     4.32:1. Fix: white fill with a `citius-blue/60` border (`aria-current` unchanged).
     "Admin only" is now `whitespace-nowrap`.
  3. `TeamDayPanel.tsx`: row actions stacked and made rows about 112 px tall. They are now
     `whitespace-nowrap`. Names "Add an entry for X" and "Correct X's times" didn't contain the
     visible label (WCAG 2.5.3). They are now "Add entry for X" and "Correct times for X"; the
     mounted test was updated.
  4. `OfficeCheckInParts.tsx`: "Awaiting review" and "Checked out" badges wrapped onto two
     lines. They are now wrapped in a `whitespace-nowrap` span (shared `Badge` untouched).
  5. `MyDayPanel.tsx`: the Clock button was natively `disabled` while busy, so Chromium dropped
     focus to `<body>`. It now uses `aria-disabled` plus a press guard. It is also
     `aria-describedby` the location notice. The office line no longer repeats the city ("Pune
     office, Pune").
  6. `location.ts`: when the browser never called back, the button stayed "Getting your
     location…" indefinitely. The spec starts `timeout` only after permission is granted. A
     30 s watchdog now resolves `timeout` and ignores late answers.
  7. `location.ts`: Playwright WebKit reported `position.timestamp` in microseconds, which the
     server would treat as `stale_reading`. Values of 1e14 or more are now scaled to ms.
     Whether real Safari does this is inferred, not verified.
  8. `OfficeRuleEditor.tsx`: Latitude and Longitude inputs stretched taller than Radius and
     Accuracy. Fix: `content-start` on `TextField`.
  9. `presentation.ts`: requirement help repeated the editor's "can't pick an easier method"
     sentence. The duplicate was removed.
  - Regression tests: busy button stays focusable and ignores a repeat press; watchdog
    timeout and late answer; microsecond timestamp. `bun test --isolate` on officeCheckIn plus
    lib: 42 pass. `tsc` (native, no route-type refresh): no errors. `bunx ultracite check` on the
    10 touched files: clean.
  - Items 5 (office label) and 9 were checked by tests and `tsc` only and were not
    re-rendered.
- **Open (not changed: outside scope or needs a decision):**
  1. Shared `Badge` amber tone (`bg-citius-orange/15 text-amber-700`, 13px semibold) measures
     4.37–4.40:1 for "Uncertain" and "Awaiting review", failing 1.4.3 AA. Owner: shared
     `portalWorkspaceListUi.tsx` and design tokens.
  2. Shared `ControlledDialog` / Base UI: the background gets `aria-hidden` but not `inert`.
     After one Tab cycle, focus leaks via a focus-guard span to `<body>`, the page's date input
     and table headers (Chromium and WebKit, intermittent). In runs where focus leaked, Escape
     did not return focus to the trigger. Owner: `src/components/ui/application-dialog.tsx`.
     Confirm on the real portal.
  3. Firefox not verified (launch failure above). Real-device geolocation, real Safari
     timestamps, screen-reader output and a live Convex/auth session not verified.
  4. Product: "Today in the office" keeps its title when another date is picked. The 30 s
     watchdog length needs product sign-off.

### Pass 10: Review and polish (2026-11-05)

- Skills: `better-interface` (`SKILL.md`; scope resolution, evidence rule) at code level only.
  `interface-review` (explicit, change-scoped review) and `review-animations` (explicit; no motion
  diff here) are named for the coordinator to run: `/interface-review`. No independent reviewer
  was authorised in this worker.
- Findings (code level):
  - Empty, loading, error states exist for My day, team table, admin panels, rule editor | verified
    by source and mounted tests.
  - One filled primary per panel; destructive "Remove" range uses `portal-danger-btn` | accepted.
  - `Badge` `role="status"` per badge (shared primitive) | open, owner: shared component follow-up.
  - Visual claims are unverified until the pass 9 rendered checks run | open, owner: coordinator.
- Next checks: pass 9 open items 1–4 (shared Badge contrast, shared dialog focus leak, Firefox,
  live portal); resolve backend gaps 1–3 with the Convex owner; fix the `contracts.ts` lint
  ratchet items with that file's owner.

## Task: Citius Journal blog redesign (2026-11-05)

Full brief, Accepted direction and pass records 0-10 live in
[frontend-passes/citius-journal.md](frontend-passes/citius-journal.md) (written by a parallel
worker so it could not collide with the office check-in section above).

### Decisions recorded by the coordinator
- 2026-11-05: user chose Direction A ("Citius Journal" editorial magazine) for both pilgrim and
  corporate/MICE readers; Directors write, infrequently; typography "whatever looks good"
  (recorded as the font approval DESIGN.md requires; Newsreader scoped to the Journal).
- 2026-11-05: user confirmed the site nav label stays "Blog"; the page itself is branded
  Citius Journal. Renaming the label would wrap the shared header at 1280-1600px.

## Task: Simplify office check-in UI (2026-11-05)

### Brief

- **Outcome.** The owner found the live Office check-in screen (PR #299) hard to read: one long
  page of tables, menus and forms. Directors and managers, not developers, use it. Make it calm,
  short and obvious without losing any capability or the audit trail.
- **Constraints.** No backend change (`convex/**` untouched). Staff Workspace tokens, `Panel`,
  `Badge`, `ControlledDialog`, `PortalDateInput`, `Select`, `usePortalConfirm`, `usePortalToast`
  reused; no new fonts or colours. `saveRule` needs a 3–500 character reason, `expectedVersion`
  and `confirmEnforcement` on every enforce save; `assignStaffOffice` is one person per call with
  a reason.
- **Flows.** (1) Clock in/out; (2) manager opens a row and reviews, corrects or adds an entry;
  (3) admin edits what an office checks, including Enforce; (4) admin assigns staff in bulk;
  (5) admin adds an office; (6) admin reads history and unmatched networks.
- **Verification targets.** Mounted tests for the section split by role, combined status words,
  the single row action and dialog (review needs a reason), coordinate parsing (valid, swapped,
  invalid), Advanced hidden by default, Enforce confirmation, batch assignment per person.
  Typecheck, `lint:all`, `deadcode:ratchet`, full `bun run test`, repo React Doctor, fixture
  renders in Chromium and WebKit at 1440 and 390.
- **Source revision.** Base `2a8fc81d` (origin/main) on branch `feat/simplify-office-check-in-ui`.

### Accepted direction

- **Composition.** Two sections behind underline tabs ("Today", "Office setup"); the switch shows
  only when `canAdminister` (exact Admin or `manage:staff`, unchanged). Reason: app-screens §8.2
  "one view per area" and §4.4 underline tabs; repo precedent `NotificationInbox` (fieldset +
  `aria-pressed` buttons, `citius-blue` underline). No new route: setup is rare, the permission
  gate is the same view, and a route would add manifest, nav and role-fixture churn. The admin
  overview query now subscribes only while Office setup is open.
- **Today.** My day: office and date in the subtitle, one plain rule sentence, one large Clock
  in/out button (48px, full width on phones), times at 24px, the result badge, and reasons only
  when a check didn't pass. Team: Name, one combined status in words, "in → out", one "Open" per
  row; phones get two-line rows (app-screens §12). Office filter only with more than one office
  (or while one is chosen). Department subline and sort arrows dropped; office subline only when
  rows span offices. Title "Team today" or "Team on DD/MM/YYYY".
- **One record dialog.** Opens on the job the row needs: Add entry when there's no record, Review
  when it's awaiting review, otherwise details with Review / Correct times. The record summary
  (status, times, each signal as a sentence, review note, collapsed History) stays above every
  form; Back returns to details. Every save still needs a reason.
- **Office setup.** Offices as cards (name, mode badge or "Not set up", code and city, one sentence
  of what it checks, "Staff (n)", "Edit"). "Add office" is a small header button opening a
  three-field dialog that hands off to Edit. "History and pilot networks" is one collapsed section.
- **Edit dialog.** "What should we check?" radios (Location, Office internet, Either one, Both)
  with one-line help. Location: one field that reads pasted Google Maps coordinates or a Maps
  link, reads the pin back with a "Check it on Google Maps" link, and offers a one-click fix for a
  swapped pair; Radius defaults to 150. Office internet: address + name rows, Add address.
  Advanced (collapsed): accuracy limit (75), time zone (Asia/Kolkata), address types, Mode. Reason
  is a pre-filled single line ("Updated Pune office settings" / "Set up Thane office").
- **Type, colour, icons, motion.** Existing tokens and type roles; `tabular-nums` on times and
  counts; one filled primary per view or dialog. Only new motion: a chevron rotation on the two
  disclosures (`transition-transform` on state, not hover; collapsed by the global reduced-motion
  rule). Existing press scale 0.96 and 160ms ease-out unchanged.

### Pass 0: Brief and contract (2026-11-05)

- Skills: none (frontend-aio `SKILL.md`, `references/skill-sets.md`,
  `references/context-and-findings.md`, `references/routing.md` §1).
- Path: specific request; simplification within the accepted Staff Workspace look.
- Findings:
  - `OfficeRuleEditor.tsx` sent `confirmEnforcement: false` when saving an office already in
    Enforce; `saveRule` (`convex/crm/officeCheckInAdmin.ts:284`) and its integration test ("every
    later enforce save asks again") reject that with `ENFORCEMENT_CONFIRMATION_REQUIRED`, so an
    enforcing office could not be edited from the UI | resolved at the client against the server
    contract | implemented: every enforce save confirms ("Turn on Enforce…?" or "Save … with
    Enforce on?") and sends `true`; mounted test added.
  - Editor hint said "IPv4 /16 or narrower" while the server requires /22 | CIDR wording removed
    from the main path; server message still shown on error | implemented.
- Decisions: no backend change needed | every requested behaviour maps to existing mutations.

### Pass 1: Inspiration (2026-11-05)

- Skills: repo references only (`NotificationInbox.tsx` underline filter, `QueryHistoryControls`,
  `StaffTravelWorkspace` pressed-button switches). External research not run (gated, not needed).

### Pass 2: Taste and design direction (2026-11-05)

- Skills: `design-taste-frontend` app-screen chapter
  (`~/.agents/skills/design-taste-frontend/references/app-screens.md` §2.2, §4.4, §7, §8, §10–13).
  `draw.mjs`/`inspect.mjs` not run (they deal a new style; the brief keeps house tokens).
  `frontend-design:frontend-design` not loaded in this worker.
- Findings: one long page of every area (§8.2) | Today / Office setup | implemented. Seven sortable
  columns, two status pills and up to two buttons per row (§7.6, §7.8) | four columns, one status,
  one Open | implemented. Settings, assignment, unmatched networks and audit all expanded | cards,
  dialogs and one collapsed section | implemented. Uppercase "NAME" labels on phone cards (DESIGN.md
  bans eyebrows) | custom two-line rows | implemented.

### Pass 3: Layout and structure (2026-11-05)

- Skills: `better-layout` (`SKILL.md`).
- Findings: phone filter row stacked Date and Office and pushed rows down | 2-column grid under
  `sm` | implemented. Summary counts wrapped "2 not / in" | each count `whitespace-nowrap` |
  implemented. Checklist result squeezed long names | moved under the name | implemented. Dialogs
  scroll their body with a pinned footer (`OfficeDialog`, `DialogBody`, `DialogFooter`) so Save
  stays reachable at 390 | implemented. No horizontal overflow at 1440/390 in either engine.

### Pass 4: Typography, colour and icons (2026-11-05)

- Skills: `better-typography` ("Before you finish"); `better-colors` not needed (no new colours).
- Findings: new dialog inputs at 14px would zoom iOS Safari | `text-base sm:text-sm` | implemented.
  Times and counts `tabular-nums`; "→" and en dash in ranges | implemented.

### Pass 5: Accessibility (WCAG 2.2 AA) (2026-11-05)

- Skills: `better-accessibility` (`SKILL.md`).
- Findings:
  - Section switch: native buttons with `aria-pressed` in a labelled fieldset (repo pattern) |
    verified by keyboard in Chromium and WebKit.
  - "Open {name}", "Edit {office}": visible label starts the name (2.5.3) | tested. "Staff (n)"
    keeps its visible name and is `aria-describedby` the card title | implemented.
  - Coordinates field: `aria-invalid` on invalid/swapped; hint and polite status linked | tested.
  - Checklist: native checkboxes in wrapping labels, office subline linked, per-person result in the
    row, totals in a `role="status"` line | tested.
  - Dialog focus lands inside on open; Escape closes and returns focus to Edit / Open (both
    engines) | verified. Row details dialog lands on "History" (first tabbable) | open, minor.
  - My day live region stays rendered while empty | implemented.

### Pass 6: Writing (2026-11-05)

- Skills: `better-writing` (`SKILL.md`); `design:ux-copy` not loaded.
- Findings: "office network", "range", "CIDR", "Kind", "geofence" on the main path | one
  vocabulary: "office internet", "address", "location", "pin"; jargon only under Advanced or in
  server errors | implemented (mounted test asserts no CIDR/geofence/proxy outside Advanced).
  Signal reasons said "Your device" while managers read them about others | neutral "The device…",
  "Connected through…" | implemented. Status words: In · Pass, In · Uncertain, In · Fail,
  Out · Pass, Out · Manual entry, Awaiting review, Rejected, Not in. Review question "Does this
  check-in count?" with "Yes, accept it" / "No, reject it". Errors say what to do.

### Pass 7: Interaction and motion (2026-11-05)

- Skills: `animate` (Hard Rules, steps 1–2). No new animation beyond the disclosure chevron;
  dialogs keep the portal's no-open-animation policy. Batch save is sequential with per-row
  "Saving… / Saved / Not saved", and Save again resends only the people still pending.

### Pass 8: Implement (2026-11-05)

- Skills: `vercel-react-best-practices` (headings), `tdd` (repo bun:test + JSDOM convention).
- Files: `OfficeCheckInView.tsx`, `MyDayPanel.tsx`, `TeamDayPanel.tsx` (own table + phone list),
  `TeamRecordDialogs.tsx` (one dialog, modes), `OfficeCheckInParts.tsx` (`OfficeDialog`,
  `DialogBody`, `DialogFooter`, `ToneBadge`, `ServerError`), `OfficeSetupPanel.tsx` (was
  `OfficeRulesAdmin.tsx`), `OfficeSettingsDialog.tsx` (was `OfficeRuleEditor.tsx`),
  `OfficeStaffDialog.tsx` (new), `src/lib/officeCheckIn/ruleDraft.ts` (new: `parseCoordinates`,
  `draftFromRule`, `checkRuleDraft`), `presentation.ts` (`REQUIREMENT_CHOICES`,
  `describeOfficeCheck`, `teamStatusFor`, copy).
- Behaviour: a part the chosen check doesn't use is hidden and its saved values are sent back
  unchanged, not cleared. Tests: `OfficeCheckInView.mounted.test.jsx` (14),
  `OfficeSetup.mounted.test.jsx` (9; replaces `OfficeRuleEditor.mounted.test.jsx`),
  `ruleDraft.test.ts` (9), `officeCheckInClient.test.js` (+1).

### Pass 9: Verify the final source (2026-11-05)

- Method: temporary dev-only route `src/app/office-check-in-fixture/` rendering the real
  `OfficeCheckInView` with a fake `ConvexProvider` client (staff, manager, admin; one assignment
  fails on purpose) and a stubbed `fetch`, on `next dev --port 3419` with an unreachable
  `NEXT_PUBLIC_CONVEX_URL`. Playwright 1.64 from the main checkout (the worktree's 1.63 has no
  installed WebKit build). Route deleted and server stopped afterwards.
- Evidence: `/private/tmp/claude-502/-Users-sharm1-Downloads-projects-citius-travel-website/3178dbb2-bff9-41ac-a7e1-8a314524c14d/scratchpad/simplify-ui/`
  (`before/` 16 shots, `after/` 40 shots, `after-results.json`, `checks.mjs`, `shots.mjs`).
- Observed: no page errors, no horizontal overflow, both engines at 1440 and 390. Keyboard: Tab
  reaches the switch with a visible outline and Enter switches; Edit opens with focus inside;
  Enter on the summary opens Advanced; Escape closes and restores focus to Edit and Open.
- Checks: focused `bun test --isolate` 60 pass; `bun run typecheck` exit 0; `bun run lint:all`
  exit 0 (after a frozen-lockfile install of `citius-blog` deps in this worktree);
  `deadcode:ratchet` passed (131/183); `bun run test` 2226 pass, 0 fail; repo React Doctor on
  changed files: no errors; one accepted warning, `async-await-in-loop` in `OfficeStaffDialog.tsx`
  (sequential on purpose so each person shows their own result).
- Not verified: Firefox; a live Convex/auth session; screen-reader output; real devices.

### Pass 10: Review and polish (2026-11-05)

- Skills: `better-interface` (scope rules), `make-interfaces-feel-better` (tabular numbers,
  existing press scale, no `transition-all`). No independent reviewer authorised in this worker.
- Open (owner):
  1. Row details dialog first focuses the "History" summary; consider `initialFocus` on the
     primary action (`ControlledDialog` supports it) | next UI pass.
  2. Earlier open items still apply: shared `Badge` amber contrast (4.37–4.40:1) and the shared
     dialog focus leak | shared component owners.
  3. View mounted tests print React `act(...)` warnings (tests pass); not traced | test owner.
  4. Product: removing someone from an office leaves them unable to clock in (the checklist says
     so); an "unassigned staff" view may be wanted later | product.

## Task: Journey payment and invoice card (2026-11-07)

### Brief

- **Outcome.** In the Customer Travel Account Journeys detail, a paid booking shows one
  "Payment and invoice" card: amount paid, payment state (Received or Refunded), the GST tax
  invoice number, and a "Download tax invoice (PDF)" link — or "Being prepared" with a note that an
  email will follow. Unpaid bookings show nothing new.
- **Audience.** The booking's purchaser, usually arriving from the confirmation or "invoice ready"
  email; occasional.
- **Constraints.** Refinement of the accepted Account baseline (DESIGN.md): no new layout system,
  fonts, tokens or eyebrow text; Staff Workspace untouched; the link is a plain download to the
  owner-checked API route.
- **Scope.** Passes 2 (scoped), 3, 5, 6, 8, 9. Inspiration (1), typography/colour (4) and motion
  (7) not applicable: the card reuses the existing `account-card`, `account-display` heading, the
  `<dl>` fact grid from the Confirmed trip packet, and the outlined pill action from Settings.

### Accepted direction

- One card placed directly under the hero so a customer arriving from email finds it first.
- Facts as a three-column `<dl>` (one column below `sm`), `tabular-nums` for amount and number.
- Action: existing outlined pill (`min-h-11`, `account-focus`), label names the file type.

### Pass records

- **Layout (3).** Card sits between the hero and the itinerary; no width or grid change elsewhere.
- **Accessibility (5).** Section labelled by its `h3`; `dt`/`dd` pairs; link text is
  self-describing; 44 px target; focus ring from `account-focus`.
- **Writing (6).** "Payment and invoice", "Amount paid", "Received"/"Refunded", "Being prepared",
  "We will email you when your GST tax invoice is ready to download here."
- **Implement (8).** `JourneyPaymentCard` in `src/components/account/AccountJourneysPanel.js`;
  `formatAccountAmount` in `accountPresentation.js`; mounted tests in
  `JourneyPaymentCard.mounted.test.jsx` (issued, preparing, refunded, unpaid).
- **Verify (9).** Mounted tests pass. Not verified: a rendered browser screenshot against a live
  Convex/auth session.
