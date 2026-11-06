## Task: Simplify Team Directory, Travel schedule and Event Photo Booth (2026-11-05)

Slices E, F and G of the admin simplification audit (2026-11-05, base `origin/main` `2a8fc81d`).
Branch `ui/team-travel-booth-simplify`. Evidence is local fixture evidence only: no backend, no
auth, no deployment, no live proof.

### Brief

- **Users:** heads, HR and Directors (Team Directory); every staff member, with HR, Operations Head
  and Directors/Admin managing others (Travel schedule); Admin, Directors and assigned event staff
  (Event Photo Booth).
- **Questions per screen:** "How do I reach this colleague?", "Who is away, where, and until
  when?", "Is the booth open, and how is the event going?".
- **Constraints (coordinator):** keep the Staff Workspace design language; no change to
  route-manifest titles, `PORTAL_NAV_GROUPS`, shared table components or `convex/**`; Function is
  made optional locally, not through a shared `defaultHidden`; keep the cancel-trip confirmation,
  U11 and the travel failure recovery; keep Save, Publish and conflict behaviour and the ADR 0016
  photo boundary (staff never see participant photos).
- **Write scope:** `TeamView.tsx`, the `team` entry of `listFilterConfig.js`,
  `StaffTravelWorkspace.tsx`, `TravelWorkspaceUi.tsx`, `EventPhotoBoothEditor.tsx`,
  `EventPhotoBoothView.tsx`, their tests, and this file.
- **Verification targets:** acceptance rows E, F and G of the audit; Chromium and WebKit renders
  at 1440 and 390; the repository checks listed under pass 9.

### Accepted direction

- **Composition:** each screen answers its question first. Team keeps the shared table and adds a
  local compact phone card. Travel becomes a quiet view switch plus one primary action, then trips
  grouped by time. The Photo Booth status and totals share the first panel; scenes follow; staff
  access lists assigned people first.
- **Hierarchy and density:** one filled primary per view (Add travel; Save draft on the booth).
  Group headings with a muted count replace per-row status pills. Rows over cards: one bordered list
  per travel group with 1px dividers (app-screens 7.1 and 7.3).
- **Type, colour, icons:** existing tokens only (`font-heading` for headings, Inter body,
  `brand-*` colours, `citius-blue` links). No new fonts, no eyebrow labels (DESIGN.md). Colour only
  for state: emerald tint on "Open". Lucide `Phone` and `Mail` at 14px in the phone card only.
- **Motion:** none added. `transition-colors` only, per `docs/TRANSITION_POLICY.md`. The confirm
  dialog keeps its own reduced-motion behaviour.
- **Targets:** at least 44px for row actions and phone links; table links at least 24px (WCAG
  2.5.8 minimum).
- **References:** the audit's 1.4, 1.6 and 1.7 proposals; `NotificationInbox`'s underline
  `aria-pressed` filter as the in-product pattern for the travel view switch; `PortalConfirmDialog`
  for Open/Close (focus on Cancel, Escape cancels).

### Pass 0: Brief and contract (2026-11-05)

- Skills: `frontend-aio` (`~/.agents/skills/frontend-aio/SKILL.md`, `references/skill-sets.md`,
  `references/context-and-findings.md`).
- Scope: the three screens above. A specific request, so the accepted composition is refined, not
  replaced.
- Decisions: record in `frontend-passes/team-travel-booth.md`, not `FRONTEND-HANDOFF.md` |
  coordinator brief.

### Pass 1: Inspiration (2026-11-05)

- Skills: none beyond the product itself (gated `research` not run).
- References: `NotificationInbox` filter tabs, `PortalConfirmDialog`, audit screenshots under
  `scratchpad/admin-audit/shots/`, and Office check-in's verified pass 9 patterns named in the
  audit (1.8): confirm with focus on Cancel; mobile cards.

### Pass 2: Taste and design direction (2026-11-05)

- Skills: `design-taste-frontend` `references/app-screens.md` (sections 2.2, 7, 8, 12, 13),
  `make-interfaces-feel-better`.
- Findings:
  - Travel toggle filled primary, Add travel outline | weight reversed (app-screens 8.3) |
    implemented.
  - Travel 110px cards, no time grouping | the scan job is slow | implemented.
  - Team "Name / Function / Access" repeat | three columns say one thing | implemented.
  - Photo Booth totals below a long form | the during-event view is buried | implemented.
- Decisions: Accepted direction above.

### Pass 3: Layout and structure (2026-11-05)

- Skills: `better-layout`.
- Findings:
  - Team phone cards were 6-field grids (4,879px at 390) | implemented as a three-line card: name;
    role · department · location; phone and email links (2,654px).
  - Travel actions | Edit trip and Cancel trip sit in one trailing column at the same pitch;
    confirmation replaces them in place.
  - Booth order | status and totals, then scenes, then staff access. Scenes were not collapsed,
    because the mounted suite edits them on mount and the coordinator kept Save/Publish unchanged.
  - Staff list | assigned first; everyone else behind a search capped at 8 results, so the page no
    longer lists the whole company.
- Remaining checks: none.

### Pass 4: Typography, colour and icons (2026-11-05)

- Skills: `better-typography` (headings only), `make-interfaces-feel-better` (tabular numbers).
- Findings: tabular numbers on mobile numbers, travel dates and group counts | implemented. Emails
  no longer break mid-word (`whitespace-nowrap` in the table; truncation in the phone card) |
  implemented after the first 1440 render showed "bhavesh@citius.exam / ple".
- Decisions: "Cancel trip" uses muted ink with a red hover rather than red on every row, which
  echoes the audit's X2 concern | rendered.

### Pass 5: Accessibility (2026-11-05)

- Skills: `better-accessibility`.
- Findings (all implemented and covered by mounted tests):
  - `mailto:` and `tel:` links carry names that contain the visible text ("Email Bhavesh Mehta at
    …", "Call Bhavesh Mehta on …"). No `tel:` link without a number.
  - "(you)" marks the current user beside the blue name (1.4.1, colour not the only cue).
  - The travel switch uses `aria-pressed` buttons in a labelled fieldset. The view name is an
    `sr-only` h2 and the groups are h3 with "n trips" spoken.
  - Opening the trip form moves focus to its heading. Closing or saving returns focus to Add
    travel. "Cancel trip" moves focus to "Keep trip", and Keep trip returns it.
  - Open/Close booth: alertdialog, initial focus on Cancel, Escape resolves false with no mutation,
    focus returns to the trigger.
  - Publish is described by its hint when it is waiting for a saved draft.
  - The staff search has a visible label, `type="search"` and a polite result summary.

### Pass 6: Writing (2026-11-05)

- Skills: `better-writing`.
- Decisions:
  - "Access" becomes "Role" (header "Name and role").
  - View names: "Team travel" and "My trips". The toggle and the view heading match. Empty states:
    "No current or upcoming team travel." and "You have no trips recorded."
  - The form's "Cancel" becomes "Close without saving". Row actions are "Edit trip" and "Cancel
    trip". The confirmation says "Cancel this trip? It leaves team travel." with Keep trip and
    Cancel trip. "Cancel trip" now appears once.
  - In-form "Load more" names its object: "Load more people", "Load more Job Cards", "Load more
    trips".
  - Booth: "Open the booth?" with "Anyone with the booth link can create photos until you close
    it." and "Close the booth?" with "Guests with the booth link will see that it is closed and
    can't create new photos." Publish hint: "Save your draft first; publishing shows it to guests."
  - "Add travel" and "Save travel" were kept as the coordinator named them, so "travel" and "trip"
    both remain | open, owner pass 6 in a later task.

### Pass 7: Interaction and motion: not applicable: no motion was added; existing transitions stay within the transition policy.

### Pass 8: Implement (2026-11-05)

- Skills: `vercel-react-best-practices` (rules only), `tdd` conventions (bun mounted tests).
- Commits: `cc2f6c0d` (E), `7b03775e` (F), `661bd61d` (G), plus a follow-up React Doctor fix and
  this record.
- Tests:
  - New `TeamView.mounted.test.tsx` covers columns, the optional Function column, links and the
    phone card.
  - `listFilterConfig.test.js` checks the department-only filter and that search still matches
    role and function.
  - New `StaffTravelWorkspace.mounted.test.tsx` covers grouping, the single primary, view names,
    the cancel confirmation and U11 (person disabled while saving, draft kept after a ConvexError,
    retry sends the same person).
  - `EventPhotoBoothEditor.mounted.test.tsx`: two existing tests now confirm the dialog before the
    same mutation assertions, and the staff test types a search first. Three tests were added:
    confirmation and Escape, panel order, and the assigned-first search.

### Pass 9: Verify the final source (2026-11-05)

- Rendered (observed, fixture only): a temporary dev route with a fake Convex client on
  `next dev --port 3424`, captured in Playwright Chromium and WebKit at 1440×900 and 390×844 with
  reduced motion. The route was deleted and the server stopped afterwards.
  - Before and after shots are in
    `/private/tmp/claude-502/-Users-sharm1-Downloads-projects-citius-travel-website/3178dbb2-bff9-41ac-a7e1-8a314524c14d/scratchpad/admin-ui/team-travel-booth/`.
  - Page heights:
    - Team at 390: 4,879 → 2,654px.
    - Travel (HR) at 1440: 1,159 → 901px.
    - Booth at 1440: 2,648 → 1,767px (Chromium).
  - No horizontal overflow at 390.
  - Before: clicking Open booth fired `setAvailability` immediately. After: a dialog with focus on
    Cancel and no mutation.
- Checks: see the task report (typecheck, `lint:all`, `deadcode:ratchet`, `bun run test`, React
  Doctor `--scope changed`).
- Limits:
  - Fixture data only. No real paging volume, auth or Convex.
  - A hydration-mismatch warning on the Team fixture page also appears in the before run. It is
    inferred to come from the fixture, not this change.

### Pass 10: Review and polish (2026-11-05)

- Skills: `make-interfaces-feel-better` (quick review).
- Open findings:
  - Function stays visible by default (6 columns), because starting it hidden needs the shared
    `defaultHidden` (audit X3, approval-gated) | owner: slice H or a later approval.
  - The Photo Booth still has no shared page title; manifest titles are off limits | owner: slice H.
  - Person and Job Card pickers still page with "Load more" rather than searchable selects (audit
    1.6) | owner: a later travel task.
  - "Has access" lists assigned staff among loaded staff only. The view now loads 100 (the server
    cap) per page, and a later page could still hold assignees | owner: a server-side "assigned
    staff" query, which is a `convex/**` change.
  - Location filter for Team not added (the audit said "if wanted") | owner decision.
