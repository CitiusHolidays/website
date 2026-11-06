## Task: Settings and Live controls simplification, slices A and B (2026-11-05)

Linked from `FRONTEND-HANDOFF.md` by the coordinator. Local evidence only: fixture renders and local
checks. Nothing was pushed, deployed, migrated or written to Convex.

Evidence folder (scratchpad, not committed):
`/private/tmp/claude-502/-Users-sharm1-Downloads-projects-citius-travel-website/3178dbb2-bff9-41ac-a7e1-8a314524c14d/scratchpad/admin-ui/settings/`
(`before-*` and `after-*` PNGs for Chromium and WebKit at 1440 and 390, plus metrics JSON and check
logs). Source audit: `scratchpad/admin-audit/AUDIT.md` §1.1, §2–3, slice rows A and B.

### Brief

- **Outcome.** The owner finds Settings overwhelming. Make the everyday job (staff access) the
  first thing an Admin or Director sees, and make the Live feature controls safety surface easier to
  read without changing its behaviour.
- **Users.** Admin (exact `Admin` role) and Directors (`MANAGE_STAFF`). Director Cement excluded,
  as before.
- **Coordinator decisions applied.**
  - Tabs: Staff (default), Dropdown values, Leave workbook, Live controls (exact Admin only, the
    same `isExactAdmin` gate). `?tab=` in the URL. No new route.
  - Dropdown values stay read-only, retitled "Workflow dropdown values (read-only)". No editing.
  - No change to the shared CRM table, `PORTAL_NAV_GROUPS` or route-manifest titles.
  - Staff rows: Edit visible; Send and Delete in More; Delete confirmation unchanged.
  - Fix the always-green result card first, with a failing mounted test.
  - Live controls: collapse groups by default except those with Paused, Blocked or Staged
    controls; raw IDs behind a disclosure; target identity stays visible; same mutation arguments.
- **Constraints.** `CONTEXT.md` Staff Workspace baseline, `DESIGN.md` (no eyebrows, no font change),
  `docs/TRANSITION_POLICY.md`, `docs/OPERATIONAL_CONTROLS.md` ("every screen shows the environment,
  deployment identity, and source revision"). No `convex/**` changes.
- **Verification targets.** Slice A and B acceptance rows; mounted tests; typecheck, lint:all,
  deadcode:ratchet, full test suite, pinned React Doctor; Chromium and WebKit renders at 1440/390.

### Accepted direction

- **Composition.** One question per view (app-screens §2.2, §8.2 "one view per area"). Settings is
  four tabbed views using the existing `PortalTabs`. Staff first, because "Add Staff" is the page's
  only primary action and staff changes are the frequent job. Live controls keep their own inner
  tabs (Feature controls, Test Lab, Activity); they are unchanged.
- **Density.** Staff table: five default columns (Name with email underneath, Roles, Department,
  Status, Action); identity gets the most width (§7.4). One status mark per row (§7.6): the
  Active and Onboarding badges merge into "Active · Ready / Pending / Not started" or "Inactive".
  All twelve columns remain one click away via a local "Show all columns" toggle.
- **Actions.** One visible action per row (Edit) plus a More menu, reusing `QueryRowActions`, the
  convention already approved in `docs/PORTAL_CRM_WORKFLOWS.md`.
- **Live controls.** Quiet groups collapse to a single header line with a summary ("14 controls ·
  all available"). Anything not plainly available (paused, blocked, temporary, staged) starts
  open. The result of the latest change leads the Feature controls tab. Identity on one line
  (environment · deployment · short revision), full revision one disclosure away.
- **Type, colour, icons.** Existing tokens and components only. Result tone: emerald with a check
  for success, red with `CircleAlert` for a failed restoration. Badge tones unchanged from the
  existing Onboarding/Active semantics.
- **Motion.** None added. Group chevrons rotate without transition (frequent, low-value motion,
  `make-interfaces-feel-better` §19). Menus use the existing `PortalActionMenu` motion.
- **Targets.** New controls are `min-h-11` on touch (44px) and `md:min-h-9` where they sit beside
  existing 36px row buttons.

### Pass 0: Brief and contract (2026-11-05)

- Skills: `frontend-aio` (`~/.agents/skills/frontend-aio/SKILL.md`, `references/skill-sets.md`,
  `references/context-and-findings.md`).
- Scope: `workspace/admin/SettingsView.tsx`, `settings/OperationalControlsPanel.tsx`,
  `settings/OperationalControlPanelSections.tsx`, `settings/StaffWorkbookImportPanel.js`,
  `entityModal/EntityModalStaffFields.js`, and their tests.
- Findings (verified against source at `2a8fc81d`, all observed):
  - `SettingsView.tsx:122` rendered `OperationalControlsPanel` above staff for exact Admins.
  - Staff table had 12 columns and three stacked row buttons (`:86-99`).
  - `LatestChangeReceipt` was hard-coded `border-emerald-300 bg-emerald-50` with a `Check` icon for
    every status, including `restoration_failed`.
  - Workbook import had no way to close (`SettingsView.tsx:118`).
  - Staff modal was one flat list of 16 fields.
- Decisions: path = specific request, refinement of the accepted Staff Workspace composition.

### Pass 1: Inspiration: not applicable

Refinement inside an established design system; references are the repo's own screens
(`HotelRoomingView` for `?tab=` tabs, `QueryRowActions` for the More menu,
`EntityModalProposalFields` for sectioned modal fields).

### Pass 2: Taste and design direction (2026-11-05)

- Skills: `design-taste-frontend/references/app-screens.md` §2.2, §4.4, §7, §8, §10, §11;
  `make-interfaces-feel-better`.
- Findings: before screenshots (`before-admin-*`) show the staff job starting about 5,000 px down
  at 1440 (page 7,823 px; 16,330 px at 390). Recorded the Accepted direction above.

### Pass 3: Layout and structure (2026-11-05)

- Skills: `better-layout`.
- Findings:
  - `SettingsView.tsx` | four areas on one scroll | split into tabs | implemented, verified.
  - Staff row | three stacked buttons made ~150 px rows | Edit + More, rows ~53 px | verified.
  - 390 | tab strip wider than viewport | `PortalTabs` scrolls horizontally with a visible peek of
    the next tab (hint at hidden content) | verified in both engines; no page overflow
    (`scrollWidth == clientWidth == 390` in every scenario).
  - Live controls | latest result rendered after the whole catalog, off-screen | moved above the
    catalog (`OperationalControlsPanel.tsx`) | verified.
- Decisions: settings tabs inherit the shared header's search; the toolbar is shared, so it is not
  scoped per tab here (open item 2).

### Pass 4: Typography, colour and icons (2026-11-05)

- Skills: `better-typography` headings only (no type changes needed), `better-colors` not needed.
- Findings: workbook labels used uppercase tracked text that `DESIGN.md` bans
  (`StaffWorkbookImportPanel.js` ActionBadge, SummaryTiles, field labels) | sentence case |
  implemented, verified. Workbook tile figures use `tabular-nums`.
- Remaining: the uppercase "NAME" label above each 390 card comes from the shared
  `ResponsiveDataCards.tsx:88` and appears on every CRM list | open, owner: shared-table slice (H).

### Pass 5: Accessibility (2026-11-05)

- Skills: `better-accessibility` (WCAG 2.2 AA).
- Findings:
  - Group headers are real `<button aria-expanded aria-controls>` inside the `h3`; the collapsed
    panel is `hidden`, so its controls leave the tab order. Accessible name includes the summary.
  - Result card keeps `role="status"`; its failure state no longer relies on colour alone (icon,
    heading "Automatic restoration needs attention", and a sentence with the next step; 1.4.1).
  - More menu: `aria-label="More actions for {name}"`; Delete keeps
    `aria-label="Delete {email}"` (visible label first, 2.5.3).
  - Merged status badge carries `meaning` ("Active, onboarding pending") as its accessible label.
  - Workbook Close is disabled while a parse, preview or apply is running.
- Not verified: screen-reader announcement order in a real AT; keyboard walk was exercised in
  mounted tests (menu opens on ArrowDown), not by hand in the browser.

### Pass 6: Writing (2026-11-05)

- Skills: `better-writing`.
- Changes: "Staff allowlist" → "Staff access" with a one-line subtitle; "Workflow dropdowns" →
  "Workflow dropdown values (read-only)" with "They can't be changed here."; "Matrix default" →
  "From leave matrix"; workbook tiles → "Rows read", "Couldn't read", "New staff", "Changes",
  "No change"; "Runtime boundary" → "Where it is enforced"; "Effect history" → "What the system
  did"; modal labels in sentence case with "Maternity leave taken (times)".
- Result card leads with the outcome (`changeSetActivityLabel`) and, on failure, says what to do:
  "Automatic restoration changed nothing. Check these controls and apply a new change if they still
  need restoring." It no longer says "Restores <time>" once restoration has run or failed.
- Kept: ubiquitous terms from `CONTEXT.md`/`OPERATIONAL_CONTROLS.md` (Production Change Set,
  Normal behavior, Use normal behavior).
- Open: page title "Settings / Dropdown Management" and modal title "Staff Allowlist Entry" live in
  `portalRouteManifest.ts` and the shared modal shell | owner: slice H.

### Pass 7: Interaction and motion: not applicable

No new motion. Existing menu motion reused; chevron rotation is instantaneous.

### Pass 8: Implement (2026-11-05)

Commits on `ui/settings-simplify` (base `origin/main` `2a8fc81d`):

1. `2443c1c4` fix: failed live-control restoration renders as failed (test first).
2. `1cd1a448` feat: collapsible control groups, one-line target, Record IDs disclosure, wording.
3. `6bf7f6c2` feat: Settings tabs, slim staff table, More menu.
4. `c8e8e09d` feat: workbook Close, plain tiles, changed-fields-first preview.
5. `eb8ab81e` feat: staff modal in four sections.
6. `27a8e1c3` fix: Settings rendered while staff rows load (found by pass 9).
7. `04529f1f` fix: latest result leads the Feature controls tab; no "Restores" after the fact.
8. `2c1f0c54`, `8e4b4c2c`, `f6c0d0f6` lint and tidy-ups.

Regression tests:

- `OperationalControlPanelSections.mounted.test.jsx`: failed restoration renders with
  `data-result-tone="failed"`, no emerald classes, no check icon (failed before the fix with
  `Received: "rounded-xl border border-emerald-300 bg-emerald-50 p-4"`); quiet groups collapse,
  attention groups open, search opens groups; one-line target with the full revision in a
  disclosure.
- `SettingsView.mounted.test.jsx` (new): Staff default; Live controls only for exact Admin and
  `?tab=live-controls` falls back to Staff for a Director; `?tab=` read and written; 5 default
  columns and 12 on request; Edit on the row, onboarding email and Delete in More, Delete calls
  `deleteItem(email, removeStaff, { staffId })`; Edit form carries `joiningDate` and
  `employmentStatus`; renders while `staff` is undefined.
- `StaffWorkbookImportPanel.mounted.test.jsx` (new): Close calls `onClose`; plain labels; no
  uppercase class.
- `EntityModalStaffFields.mounted.test.jsx` (new): four sections, all 16 labels, field updates.
- The old Settings assertion in `portalTicketingAdminViews.mounted.test.jsx` moved to the new
  file (it asserted the workbook card and onboarding button on the default render).
- Unchanged and green: `OperationalControlsPanel.auth.mounted.test.jsx`, which asserts the exact
  Apply, Test Lab and Undo mutation arguments.

### Pass 9: Verify the final source (2026-11-05)

- Fixture: temporary dev-only route `src/app/settings-ui-fixture/` (copied from the audit's
  `FixtureClient.tsx`/`fixtures.ts`, plus a paginated-watch stub and a `restoration_failed` change
  set), `bun run dev -- --port 3421`, Next only. Route deleted and server stopped afterwards;
  `git status` clean.
- Before: the four slice source files from `origin/main` temporarily written into the tree, then
  restored from `HEAD`.
- Engines: Playwright Chromium and WebKit, 1440×900 and 390×844, reduced motion.
- Results (observed):
  - Admin Settings page height 7,823 → 1,442 px at 1440; 16,330 → 4,775 px at 390 (Chromium).
  - Default staff headers: Name, Roles, Department, Status, Action. "Show all columns" gives 12.
  - No page errors after the loading fix; no horizontal overflow at 390 in any scenario.
  - Live controls tab 1,892 px at 1440 with Public, CRM, Authentication, Payments and
    Infrastructure collapsed; Contact (1 blocked) and AI (1 paused) open.
  - Failed restoration card renders red with the alert icon, above the catalog.
- First after-run caught a crash: `staff.length` on `undefined` during load (SSR and client).
  Fixed in `27a8e1c3` with a mounted test.
- Best evidence: `after-admin-chromium-1440.png`, `after-admin-live-chromium-1440.png`,
  `crop-after-live-failed-1440.png`, `after-admin-more-menu-webkit-1440.png`,
  `crop-after-admin-webkit-390-top.png`, against `before-admin-chromium-1440.png`.

Checks (observed, final source `f6c0d0f6`):

- `bun run typecheck`: pass.
- `bun run lint:all`: pass (after installing `citius-blog` dependencies from its lockfile in this
  worktree; ultracite, anti-slop, lint ratchet 0/0, blog eslint).
- `bun run deadcode:ratchet`: pass (131/183 reviewed findings remain; none in these files).
- `bun run test`: pass (2,218 bun tests in 465 files; 275 vitest tests in 28 files).
- React Doctor (pinned, `--scope changed --base origin/main`): 10 files, no issues.

### Pass 10: Review and polish (2026-11-05)

Self-review against the Accepted direction on the rendered result; no independent reviewer was
run. Repaired from review: result card position, "Restores" on a finished restoration.

Open items:

1. **Reported conflict (unchanged):** R13 says Settings can pause or retune reminder rules; no UI
   exists and none was added (`convex/crm/workflowNudges.ts` `listRules`/`updateRule`).
2. **Shared header (slice H/C owner):** "Add Staff", the page search and the "N authorized records
   loaded" footer show on every Settings tab. Search filters Staff and Dropdown values only.
3. **Prop type mismatch:** `SettingsViewProps.staff` is typed as an array but
   `portalWorkspaceRows.ts:309` passes `undefined` while loading. Guarded locally; the type in the
   shared `portalViewTypes.ts` should become `PortalStaffSettingsRow[] | undefined`.
4. Not done from the audit (not in the coordinator's decisions): an Undo link on the latest
   result, and reordering the Activity tab.
5. Temporary controls also open their group (the coordinator listed Paused, Blocked, Staged); this
   is a superset and only adds visibility.
6. A one-group catalog starts open (keeps the existing auth test and has nothing to collapse past);
   the real catalog has seven groups.
7. Hosted and authenticated proof not done; fixture evidence only.
