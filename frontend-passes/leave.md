## Task: Simplify Employees on Leave, slice D (2026-11-05)

Linked from `FRONTEND-HANDOFF.md` by the coordinator. These are local checks and fixture renders only. Nothing was deployed and nothing was written to Convex.

### Brief

- **Outcome.** On `/portal/employees-on-leave`, an approver sees what is waiting for them first, and anyone sees where their own request stands. The source is the admin audit, section 1.5, slice row D.
- **Screen's one question.**
  - Approvers: "What is waiting for me, and who is away?"
  - Everyone else: "How much leave do I have, and where is my request?"
- **Constraints**
  - Leave stays two-stage: the head approves first, then HR or the final authority. One approval never completes both stages.
  - The `can*` flags come from the server. Approve and Reject keep calling `decideLeave({ leaveId, status })` unchanged. D02 routing is untouched.
  - These stay out of scope: `portalAdminUtils.ts`, the route-manifest title, `PORTAL_NAV_GROUPS`, the shared table components and `convex/**`.
  - Keep the Staff Workspace design language. No eyebrows, no font changes, no new tokens.
- **Write scope.**
  - `workspace/admin/LeaveView.tsx`
  - `workspace/admin/leaveViewModel.ts`, plus its unit test and a mounted test
  - The leave e2e assertions in `e2e/specs/workflow/role-semantics.spec.ts`
  - This file

### Accepted direction

- **Order.**
  1. "Waiting for your approval" queue, shown only when the user has a request to act on
  2. One "Away today" line, shown only to people who can see others' leave
  3. My leave balances
  4. The table
- **Removed.** The five count tiles. They had icon chips, counted only the loaded page, and none was clickable (app-screens §5).
- **Queue.** A divided list inside the existing panel surface. Each row reads as follows:
  - name and leave-type badge
  - dates, days and department
  - reason
  - progress in words
  - the applicable Approve button(s), then Reject
  - Order is soonest start first. The visible labels are unchanged. The accessible names add the person ("Approve (HR) for Gauri Deshpande").
- **Table.**
  - Seven columns: Employee (department as a grey subline), Leave Type, Start, End, Reason (hideable), Progress, Action.
  - Progress has one status badge (`leave` domain, so its accessible meaning is unchanged) plus one grey line in words, such as "Head approved · waiting for HR". Approved rows have no line.
  - Row actions: the applicable Approve plus Reject stay inline. Edit and Delete for HR go under the existing More menu (`QueryRowActions`). A requester's own pending request keeps an inline Edit.
- **Balances.** A tile only for types with a balance, plus Leave Without Pay. One quiet line lists the rest ("No balance this year: …"). "No balance row" is gone.
- **Today.** The calendar date in Asia/Kolkata, via `Intl.DateTimeFormat`.
- **Motion.** None added. Existing button press and menu motion are kept.
- **Targets.** Queue buttons are 44px on phones (`min-h-11 md:min-h-10`). Table buttons keep their existing sizes.

### Pass 0: Brief and contract (2026-11-05)

- **Skills:** `frontend-aio` (`~/.agents/skills/frontend-aio/SKILL.md`, plus `references/skill-sets.md` and `references/context-and-findings.md`).
- **Scope:** `LeaveView` and its helpers.
- **Verification targets**
  - The slice-D acceptance checks
  - Chromium and WebKit at 1440 and 390, for HR, a head approver (Sales Head), Sales and Director

### Pass 1: Inspiration (2026-11-05)

- **References:**
  - The current Staff Workspace (Queries' More pattern, `Panel`)
  - The audit screenshots `admin-audit/shots/leave-*`
- **No external references.** This is a refinement inside an accepted design language.

### Pass 2: Taste and design direction (2026-11-05)

- **Skills:** `design-taste-frontend/references/app-screens.md` (§2.2, §5, §7, §11, §12, §13).
- **Decisions**
  - The queue answers the approver's question first (§2.2).
  - KPI tiles go (§5, "no icon in a coloured circle").
  - One status mark per row (§7.6).
  - Tables become two-line cards on phones, with the identity as the lead (§12).
- **Calendar house rule.** It does not apply. No timeline was added, because the audit asked for a line, not a planner.

### Pass 3: Layout and structure (2026-11-05)

- **Skills:** `better-layout`.
- **Findings**
  - `LeaveView` table at 1440: Status and Action were cut off, with "Scroll for more columns". **Verified fixed:** the table fits its 1092px frame in both engines for all four roles, and the hint is gone.
  - Mobile cards used the Progress column as the card title (no identity column). **Fixed:** the Employee column is now `kind: "identity"`.
  - "Leave Without Pay" badge wrapped into a blob. **Fixed:** `whitespace-nowrap` wrapper.
  - The approve button wrapped under Reject in the action cell. **Fixed:** `md:flex-nowrap`, and the action column gets `width: 272` only when the queue is non-empty.
- **Remaining check.** The shared mobile-card overline ("EMPLOYEE", tracked uppercase) is an eyebrow under `DESIGN.md`. It is shared component styling, so the owner is outside this slice.

### Pass 4: Typography, colour and icons (2026-11-05)

- **Result.** Not applicable beyond reuse: there are no new tokens, and existing badge tones and button classes are used. Tabular figures are used on dates and counts.

### Pass 5: Accessibility (2026-11-05)

- **Skills:** `better-accessibility`.
- **Fixed**
  - Queue buttons carry the person in their accessible name (2.5.3 label in name kept).
  - The queue is a `section` labelled by its `h2`.
  - After a decision removes a row, focus moves to the queue heading instead of `<body>`.
  - Decisions now toast success or failure; before, errors only went to `console.error`.
  - The More trigger is labelled "More actions for leave for X", and Delete is a `menuitem` with the old accessible name.
  - The status badge keeps `role="status"` with its meaning ("Pending decision: leave approval required"), so `hr-leave.spec.ts` stays valid.
- **Not verified:** a screen-reader pass.

### Pass 6: Writing (2026-11-05)

- **Skills:** `better-writing`.
- **Copy**
  - "Waiting for your approval"
  - "Soonest start first. Each approval moves a request to its next stage."
  - "Away today · …", or "No one is on approved leave today."
  - "No balance this year: …"
  - Progress strings in plain words
- **Kept**
  - Approve labels (e2e and mounted tests depend on them)
  - "My leave balances"
  - Panel subtitle
- **Name lists** use `Intl.ListFormat`.

### Pass 7: Interaction and motion: not applicable

- No new motion. The menu and press feedback come from the existing primitives.

### Pass 8: Implement (2026-11-05)

- **Files**
  - `src/components/portal/workspace/admin/LeaveView.tsx`
  - `leaveViewModel.ts`
- **Balance logic.** `leaveBalanceRowsForDisplay` is still used. Only the partition is local, so `portalAdminUtils.ts` is untouched and nothing becomes dead code.
- **Tests**
  - `leaveViewModel.test.ts`: IST at 00:30 and 23:59, queue membership and order, away names, progress words, labels, balances, durations.
  - `LeaveView.mounted.test.jsx`, covering:
    - the queue lists exactly the flagged rows
    - queue and table Approve/Reject call `decideLeave` with identical arguments
    - Sales sees no queue
    - Progress replaces the review columns
    - Delete is under More and still reaches `deleteItem` (the confirmation path)
    - "Away today" at 00:30 IST
  - `role-semantics.spec.ts` [leave-head-then-hr] updated for Progress words and Delete under More. Not run: it needs live credentials.

### Pass 9: Verify (2026-11-05)

- **Rendered.** Temporary `src/app/leave-fixture` with a fake Convex client, run on `next dev --port 3423`. The fixture was deleted and the server stopped afterwards.
  - Clock fixed at 10:30 IST, 5 Nov 2026.
  - Shots are in `scratchpad/admin-ui/leave/{before,after}-{hr,head,sales,director}-{chromium,webkit}-{1440,390}.png`.
- **Overflow.** No page overflow at 390 or 1440 in either engine.
- **Interaction** (Chromium and WebKit):
  - Keyboard Enter on the queue's "Approve (HR) for Gauri Deshpande" sent `crm/leave:decide {"leaveId":"leave-3","status":"Approved"}`.
  - More showed Edit and Delete, and Delete opened "Delete leave for Aarti Kulkarni? This cannot be undone." with hold-to-delete.
- **Limits.** Fixture data only, with no real backend or auth.

### Pass 10: Review (2026-11-05)

- **React Doctor 0.9.11** (`--scope changed --include-untracked`): no issues.
- **Open items**
  - The queue and "Away today" read only the loaded, filtered rows. The footer says when every record is loaded. A partial-list "at least N" needs a pagination prop from `portalRouteLifecycle`, which is outside this slice.
  - The page title is still "Employees on Leave". That belongs to slice H.
