## Task: Notifications page and bell, slice C (2026-11-05)

To be linked from `FRONTEND-HANDOFF.md` by the coordinator. These are local checks and fixture renders only. Nothing was deployed, migrated or written to Convex.

### Brief

- **Source.** Admin simplification audit §1.2 (Notifications page), §1.3 (bell), §2 (X6, X8) and slice C. The decisions come from the coordinator.
- **Outcome.**
  - Every role sees the same plain inbox.
  - The Admin/Directors activity log owns its own search, dates, type filter, count and paging.
  - The inbox is grouped by day and can load older history.
  - The bell says "8 of N" when its list is cut short.
  - The email-status chips are explained in plain words.
- **Constraints.**
  - Read semantics follow `docs/reviews/notification-email-review/`:
    - opening an update marks only that update read;
    - opening the page or bell, or switching filters, marks nothing;
    - there is no "Mark all as read";
    - late arrivals stay unread.
  - No `convex/**` changes, and no edits to manifest titles, `PORTAL_NAV_GROUPS` or shared table components.
  - Keep the Staff Workspace design language: no eyebrows, no font change, `DESIGN.md` and `docs/TRANSITION_POLICY.md` apply.
- **Write scope.**
  - Within the slice: `ActivityView.tsx`, `NotificationInbox.tsx`, the `activity` branch of `PortalWorkspaceHeader.tsx`, and the bell header in `PortalShell.tsx`.
  - Minimal wiring outside the slice was needed, because the toolbar and footer cannot move into the section without passing props:
    - `portalRouteLifecycle.tsx`: ActivityView props, and route pagination is off for ActivityView;
    - `portalViewTypes.ts`: `ActivityLogControls`;
    - `notificationTargets.js` and `usePortalWorkspaceData.ts`: the shared page-size constant, 80.

### Accepted direction

- **Composition.** The page reads: title and subtitle, then Unread/All, then a list grouped by day.
  - For heads, the email panel sits on the right at `xl`.
  - The collapsed "Activity log" (with "Everyone's changes across the workspace") spans the full width below.
- **Density.**
  - Row pitch and padding are unchanged.
  - Day headings are 12px semibold muted, in sentence case. They are section headings, not eyebrows.
  - Rows show only the time, because the day is in the heading.
- **Motion.** None was added. The `<details>` disclosure is native, and no new transitions were introduced.
- **Targets.** Existing `min-h-11` filter buttons and `portal-small-btn` footers are kept.

### Pass 1: Inspiration — not applicable

This is a scoped simplification of an existing screen. The references are the audit screenshots and `app-screens.md` §2.2, §4.4, §7.8 and §11.

### Pass 2: Taste and design direction (2026-11-05)

- **Skills.** `design-taste-frontend/references/app-screens.md` (§2.2 one question, §4.4 date range at page or card level and never both, §7.8 paging, §10 density, §11 states) and `make-interfaces-feel-better`.
- **Findings.**
  - **Director page** | The page-level toolbar filtered only the collapsed log. The "6 loaded results" and footer counted the hidden log, not the inbox (§4.4: controls live where the content is). | **Implemented:** the controls and count now live inside the log.
  - **`ActivityView.tsx`** | "Your updates", the helper line and the subtitle said the same thing three times. | **Implemented:** the in-card heading and helper are removed. The nav slice owns the subtitle copy (`ui/nav-regroup`, `a47f1bc3`).
- **Decisions.**
  - Show the subtitle for every role (the same simple header as Sales). Reason: one header per page, and the manifest owns the copy.

### Pass 3: Layout and structure (2026-11-05)

- **Skills.** `better-layout` (grouping with space, order by importance, hint at hidden content).
- **Findings.**
  - **`NotificationInbox.tsx`** | The list was flat with no grouping. | **Implemented:** one `<ul>` per day under a heading. Heading spacing is 20px above and about 20px to the first row, so each heading sits with its own rows.
  - **At 390px** | Before, the inbox started at about 385px because the toolbar came first. | **Verified:** it now starts at about 150px for Directors.
  - **Activity log at 390px** | **Verified:** controls wrap with no horizontal overflow (Chromium and WebKit, 1440 and 390).

### Pass 4: Typography, colour and icons — not applicable

Existing tokens are reused. Only `tabular-nums` was added on the times and count lines.

### Pass 5: Accessibility (2026-11-05)

- **Skills.** `better-accessibility`.
- **Findings.**
  - **Day headings** | Day headings are `<h3>` elements. Each list has `aria-labelledby` pointing at its heading, and the ids come from `useId`, so they are unique when the bell and the page are both mounted. | **Implemented and tested.**
  - **Load-older button** | It has `aria-busy` and is `disabled` while loading. The count is a polite `role="status"`. | **Implemented and tested.**
  - **Activity log search** | The search field has the accessible name "Search activity log". | **Implemented.**
  - **Log state from the URL** | When filters come from the URL, the log opens on mount so that filter state is never hidden (WCAG 3.3 / 1.3.1 intent). | **Implemented and tested.**
  - **Date inputs at 390px** | The shared date inputs show the placeholder truncated ("DD/MM/YYY"). | **Deferred:** this is pre-existing in `PortalDateRangeFilter` (shared) and visible in the before shots. Owner: whoever owns the shared filter.

### Pass 6: Writing (2026-11-05)

- **Skills.** `better-writing`.
- **Findings.**
  - **Email panel, origin-less summary** | "Email event" becomes "Workflow email". | **Implemented.**
  - **Email panel legend** | The chips are now explained. The legend lists only the statuses present:
    - Accepted: the email service took the message;
    - In progress: waiting to be sent;
    - Retrying: a temporary problem that retries on its own;
    - Need attention: couldn't be sent after every automatic retry, but the update is still in the person's inbox;
    - Skipped: not sent on purpose.
  - **Email panel order** | Rows that need attention come first. | **Implemented and tested.**
  - **Email panel resend** | No resend action was added, per the review. | **Verified by test.**
  - **Activity log footer** | The log footer now reads "All 6 entries loaded", "50 entries loaded" with "Load more entries", or "1 of 50 loaded entries match". | **Implemented.**
  - **Bell header** | "Recent updates" becomes "{shown} of {N} unread", or "{N}+" when the server count is a lower bound. It shows only when the list is cut short. | **Implemented and tested.**
  - **Filter label** | "All entity types" (audit X5) comes from `listFilterConfig.js`, which is outside this slice. | **Open.**

### Pass 7: Interaction and motion — not applicable

No motion was added. The disclosure is native `<details>`.

### Pass 8: Implement (2026-11-05)

- **Older history.**
  - It comes from `useNotificationHistory` in `ActivityView.tsx`, which raises the `listNotifications` limit by 80 per click, up to 400.
  - The last result stays on screen while the next one loads.
  - It is offered only on All, and only when the last page came back full.
  - No backend change was needed, because `limit` is already an unbounded argument.
- **Tests.**
  - `ActivityView.mounted.test.jsx` covers:
    - no read on open or filter change;
    - one read per activation;
    - late arrivals stay unread;
    - empty and caught-up states;
    - day headings labelling their lists, including a year for dates outside this year;
    - "Show older updates", including its loading state and a short page;
    - log controls only inside the log, and URL filters opening the log;
    - the legend, the sort and no resend.
  - `PortalShell.mounted.test.jsx` covers "8 of 23 unread" and "8 of 40+ unread".
  - In `portalTicketingAdminViews.mounted.test.jsx`, the ActivityView harness drops the removed `activity` and `canViewActivityLog` props and mocks `convex/react`.
    - Reason: ActivityView now calls `useQuery` (skipped until "Show older updates") and therefore needs a Convex provider above it.
    - In the app it always has one.

### Pass 9: Verify (2026-11-05)

- **Rendered.**
  - Setup:
    - a temporary dev-only fixture route, `src/app/notifications-fixture` (deleted);
    - a fake Convex client;
    - `next dev --port 3422` (stopped);
    - Playwright Chromium and WebKit, at 1440 and 390, IST, with reduced motion.
  - Evidence is in `scratchpad/admin-ui/notifications/{before,after}/`.
  - Scenarios: Sales, Director, Director with the log open, a busy inbox (Unread and All), older history loaded, caught up, empty, and the bell (default and busy).
  - No horizontal overflow. The only console errors are the dummy root Convex URL.
- **Checks.**
  - `bun run typecheck`: pass.
  - `bun run lint:all`: pass, after installing `citius-blog` deps.
  - `bun run deadcode:ratchet`: pass.
  - `bun run test`: pass. Bun: 2221 tests in 462 files. Convex integration (vitest): 275 tests in 28 files.
  - React Doctor (pinned, changed scope): no errors in changed files. Two warnings:
    - `no-locale-format-in-render` at `NotificationInbox.tsx:209`. **False positive, medium confidence:** the rows load client-side from Convex, and the server renders the skeleton.
    - `no-derived-useState` at `ActivityView.tsx:228`. **Intentional:** this is the initial open state only, and the user's toggle wins afterwards.

### Pass 10: Review and polish — open items

| Owner | Item |
| --- | --- |
| Backend follow-up (inferred) | A paginated `listNotifications` to replace the 400 cap. Each raised limit reads limit × 3 rows per recipient source. |
| Owning slice | "All entity types" in `listFilterConfig.js`. |
| Shared filter owner | The truncated date placeholder in the shared filter at 390px. |
| Not changed | "Today" is computed when the inbox mounts, so a page left open past midnight keeps yesterday's labels until it remounts. |
