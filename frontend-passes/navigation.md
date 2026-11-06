## Task: Staff Workspace navigation regroup, slice H (2026-11-05)

Slice H of the admin, Settings and Notifications audit. The audit lives in the coordinator's
scratchpad, at `scratchpad/admin-audit/AUDIT.md` (section 2 row X1, section 3 quick wins 1 and 2,
and slice row H). Evidence is local only. Nothing was pushed, deployed or proven live.

### Brief

- **Outcome.**
  - The sidebar replaces the "Admin" and "System" groups, which every staff member saw, with
    **Me** and **Administration**.
    - Me: Notifications, Leave, Travel schedule, Office check-in.
    - Administration: Team Directory, Event Photo Booth, Settings.
  - "Employees on Leave" becomes "Leave". The Leave and Settings page titles and the subtitles for
    Leave, Settings and Notifications are updated.
- **Owner decisions, 2026-11-05.**
  - The regroup and the rename are approved.
  - Access must not change.
  - Column trimming stays local to each page. There is no shared `defaultHidden` option, and
    `portalDataGrid.ts` and `SelectableDataTable` are not touched.
- **Constraints.**
  - URLs and slugs stay the same (`/portal/employees-on-leave`).
  - No `convex/**` changes.
  - Page components owned by other slices are not touched.
  - The Staff Workspace baseline is kept: nav row styling, collapse behaviour and the work
    indicators are unchanged.
- **Flows.**
  1. A staff member scans the sidebar or the mobile drawer to find their personal tools.
  2. An administrator finds Team Directory and Settings.
  3. The command palette still reaches every destination.
- **Verification targets.**
  - Per-role access is identical before and after.
  - Nav and command palette tests pass.
  - Before and after renders exist for the desktop sidebar and the 390 drawer, for Sales, HR and
    Admin.
- **Aspects in scope.** Passes 0, 2, 5, 6, 8, 9 and 10. Not applicable:
  - Pass 1, inspiration: there is no new composition; the existing sidebar pattern is reused.
  - Pass 3, layout: the same row components are used.
  - Pass 4, type, colour and icons: no visual tokens changed, and icons are keyed by href.
  - Pass 7, motion: nothing animates differently.

### Accepted direction

- **Composition.** Keep the existing collapsible group pattern (`PortalShell.tsx` `PortalNav`).
  Only the labels, membership and order change. The order is:
  1. Overview.
  2. **Me**.
  3. The work areas: Enquiries, Proposals, Job Cards, Ticketing, Operations, Finance.
  4. **Administration**.
- **Why Me comes second.**
  - It is the only group every staff role has.
  - It holds daily personal tools: clocking in, the inbox and leave.
  - Products that people work in all day put the personal inbox and "my" items near the top
    (Linear's Inbox and My issues, Jira's For you).
  - Groups collapse to one row, so Me costs one row above the work areas when collapsed.
- **Why Administration comes last.** Few roles see it, and its tools are used rarely. Putting it
  last keeps it out of the way of everyday work. As before, a group renders only when at least one
  of its items is allowed (`getAccessibleNavGroups`).
- **Order inside each group** follows the owner's list. Me: Notifications, Leave, Travel schedule,
  Office check-in. Administration: Team Directory, Event Photo Booth, Settings.
- **Type, colour, icons and motion:** unchanged.

### Pass 0: Brief and contract (2026-11-05)

- Skills: `frontend-aio` (`~/.agents/skills/frontend-aio/SKILL.md`).
- Scope:
  - `src/lib/portal/constants.js` (`PORTAL_NAV_GROUPS`);
  - `src/lib/portal/portalRouteManifest.ts` (titles and subtitles);
  - tests and access docs.
- Findings:
  - `constants.js` "Admin"/"System" groups | a Sales rep saw "Admin" and "System" for their own
    tools | misleading labels | implemented.
  - `portalRouteManifest.ts:276` "Settings / Dropdown Management" | promises editing that the page
    can't do | implemented.
- Decisions:
  - The page-access fixture `tools/portal-role-pages-expected.json` holds pages only, with no group
    or label data | left unchanged on purpose.
  - The e2e registry holds view IDs, not visible labels | unchanged.
  - `PortalNavIcon` is keyed by href | unchanged.
- Remaining checks: none.

### Pass 2: Taste and design direction (2026-11-05)

- Skills: `frontend-aio` pass 2. The lead assessment was scoped to the sidebar and drawer, using
  `design-taste-frontend` app-screens guidance as cited by the audit.
- Findings:
  - Group labels that don't describe their contents for most readers | fixed by Me and
    Administration.
  - Single-item groups that repeat their item ("Proposals › Proposals") | deferred. This was not
    in the approved change.
- Decisions: the Accepted direction above.

### Pass 5: Accessibility (2026-11-05)

- Skills: `better-accessibility` (`~/.agents/skills/better-accessibility/SKILL.md`).
- Scope: sidebar group toggles, mobile drawer, document titles.
- Findings (observed in code unless noted):
  - Group toggles stay native `<button>` elements with `aria-expanded`. Their visible label is the
    accessible name, so "Me" and "Administration" are announced as written (`PortalShell.tsx`
    `PortalNav`) | pass.
  - Target sizes are unchanged: `min-h-11` in the drawer and `lg:min-h-8` on desktop | pass.
  - Document titles become "Leave | Citius Connect" and "Settings | Citius Connect", and stay
    unique. Proven by `portalRouteLifecycle.mounted.test.jsx` | pass.
- Remaining checks: a screen reader pass on a real device is not done | owner: release QA.

### Pass 6: Writing (2026-11-05)

- Skills: `better-writing` (`~/.agents/skills/better-writing/SKILL.md`).
- Findings:

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `portalRouteManifest.ts` settings | "Settings / Dropdown Management"; "Manage staff access and workflow dropdown values." | "Settings"; "Manage staff access and review workflow dropdown values." | Dropdowns are read-only on that page, so "manage" misled. |
| MEDIUM | `constants.js` nav | "Admin", "System" | "Me", "Administration" | Labels must describe the contents for every reader. |
| MEDIUM | `constants.js`, `portalRouteManifest.ts` leave | "Employees on Leave"; "Review leave requests, approvals, and team availability." | "Leave"; "Request, approve, and track leave." | One name in the sidebar and the title. Most readers request leave rather than review it. |
| LOW | `portalRouteManifest.ts` activity | "Your assignments and workflow updates." | "Open an update to go to its record." | The old subtitle restated the title. The new one names the next action. |

- Decisions:
  - "Me" uses a first-person label next to "Your updates" in `ActivityView`. Mixing perspectives
    is discouraged, but the owner chose "Me", and slice C removes "Your updates" | accepted.
  - The command palette still matches "employees", because the old URL is one of its keywords
    (test added).
- Remaining checks: until slice C lands, the Notifications helper line "Open an update to view the
  work." sits under a subtitle that says nearly the same thing | owner: slice C, which drops it.

### Pass 8: Implement (2026-11-05)

- Changes:
  - `PORTAL_NAV_GROUPS` was regrouped, with a comment recording the order decision.
  - The Notifications item and the `activity` route carry comments explaining that
    `view:emailDeliveryStatus` is not their gate (`navItemAllowed`, `canAccessPage` and
    `canAccessPortalRoute` special-case `activity`).
  - Manifest titles and subtitles were updated.
  - Dated notes were added to `docs/PORTAL_PERMISSIONS_ARCHITECTURE.md` and
    `docs/PORTAL_ROLES_AND_ACCESS.md`.
- Regression tests:
  - `permissions.test.js`:
    - every role gets Me second, with four items;
    - Administration is last and lists only allowed items;
    - Sales without booth access sees no Administration group;
    - no role sees "Admin" or "System".
  - `commandPalette.test.js`:
    - every nav href is a command;
    - Leave has the subtitle "Me";
    - "employees" still finds Leave;
    - "administration" finds the three admin items.

### Pass 9: Verify (2026-11-05)

- Source revision: base `2a8fc81d`, plus commits `37c88441`, `a47f1bc3` and `3cc6f8e6` on
  `ui/nav-regroup`.
- **Access proof (observed).**
  - A script compared `getAccessibleNavGroups` pages, `canAccessPage` and `canAccessPortalRoute`
    for every role and for no role, with booth management on and off: 40 cases. The before and
    after output is byte-identical.
  - Files: `scratchpad/admin-ui/navigation/access-before.json` and `access-after.json`. The script
    is `access-snapshot.ts`.
- **Rendered (observed, fixture).**
  - Setup:
    - a temporary dev-only route rendered the real `PortalShell` under a fake Convex client (the
      audit fixture);
    - `next dev` ran on port 3425 with placeholder public Convex URLs;
    - Playwright Chromium captured 1440 and 390 widths with reduced motion;
    - each role was shot with the default collapsed groups and with every group expanded.
  - Files are in `scratchpad/admin-ui/navigation/`, named `before-*` and `after-*`.
  - The fixture's booth access reports `canManage`, so Sales shows "Administration: Event Photo
    Booth". A real Sales user without booth management sees no Administration group (unit test).
  - The fixture and the server were removed afterwards.
- Visible side effect (observed in `groups-after.json`): the mobile drawer's fourth Quick access
  tile for HR changes from "Post-tour feedback" to "Notifications". Quick access fills its
  remaining slots in group order, and Me now comes earlier.
- Automated checks: see the slice report. typecheck, lint:all, deadcode:ratchet and test all pass.

### Pass 10: Review and polish (2026-11-05)

- Open items:
  - Stored expanded-group preferences are keyed by label (`portal-nav-expanded-groups`). People who
    had "Admin" or "System" expanded will see Me and Administration collapsed once. Owner: product.
    Accept it, or add a one-time label alias in `portalNavPersistence.ts`.
  - Before this change, Notifications sat in a one-item "System" group that was always visible.
    For most staff it now sits inside the collapsible Me group, which is one click away on desktop.
    The bell in the header is unchanged. Owner: product, to watch.
  - `WorkspacePagination` "authorized records loaded" wording (audit X5) was listed under slice H,
    but it is not part of this brief | open, needs owner approval.
  - Single-item group folding ("Proposals › Proposals") | open, not approved.
