# Portal CRM workflows

This doc records the current Citius Connect behavior implemented across recent portal and Convex commits. It is intentionally operational: the role matrix explains who can access things, and this file explains how the main workflows move.

## Main source files

| Workflow area | Primary files |
| --- | --- |
| Portal routing and list views | `src/components/portal/PortalWorkspace.tsx` |
| Shared portal state and Convex hooks | `src/components/portal/usePortalWorkspaceState.ts` |
| Shared lists, actions, and pagination | `src/components/portal/SelectableDataTable.tsx`, `src/components/portal/PortalActionMenu.tsx`, `src/components/portal/QueryRowActions.tsx` |
| Modal form lifecycle and submit routing | `src/lib/portal/modalLifecycle.js`, `src/lib/portal/modalCommandExecutor.js` |
| Query team assignment | `convex/crm/queryTeamAssignment.ts`, `src/lib/portal/permissions.js` |
| Job cards and downstream operations | `convex/crm/jobCards.ts`, `src/components/portal/jobCard/JobCardCommandCenter.js` |
| Spreadsheet import/export | `src/lib/portal/spreadsheetImports.ts`, `src/lib/portal/spreadsheetExports.ts`, `convex/crm/imports.ts`, `convex/crm/importActions.ts` |
| Notifications | `convex/crm/activity.ts`, `convex/crm/notificationReads.ts`, `convex/crm/notificationSummary.ts`, `convex/crm/notificationEmails.ts`, `convex/crm/notificationEmailDetails.ts` |
| Leave | `convex/crm/leave.ts`, `convex/crm/leaveApprovers.ts`, `convex/crm/leavePolicy.ts`, `convex/crm/leaveLapse.ts` |
| Expenses and finance | `convex/crm/finance.ts`, `convex/crm/expenseAttachments.ts`, `convex/crm/expenseAttachmentActions.ts` |
| Saved views and command palette | `convex/crm/savedViews.ts`, `src/lib/portal/savedViews.js`, `src/components/portal/PortalCommandPalette.js`, `src/components/portal/PortalShell.tsx` |
| Portal chrome and stacking | `src/lib/portal/zIndex.js` |

## Query lifecycle

Sales creates and manages enquiries from All Sales Queries. The query lead stage for a lost enquiry is `Lost`, not `Closed`.

Sales-facing decisions use Sales Decision values:

- `Under Discussion`
- `Date/Destination Change Required`
- `Order Confirmed`
- `Order Lost`

Order Lost and lost reason are sales-only. Contracting users should not see or drive that sales-only lost flow through their contracting status dropdown.

Approx. margin stays empty until Order Confirmed and is entered manually by Sales. It must not be auto-calculated from budget or contracting costs.

Contracting owner labels in portal UI read Contracting SPOC. The database fields remain `contractingOwnerId` and `contractingOwnerName`.

## Query team assignment

Sales, Sales Head, and Sales Cement can do the initial Sales assignment when they have `manage:queries`. That initial form requires a Contracting SPOC and Ticketing Scope, and it cannot assign ticketing SPOCs or reassign existing teams.

Head/director assignment can assign or reassign contracting and ticketing:

- Contracting assignment: Admin, Directors, Director Cement, Contracting Head, Operations Head.
- Ticketing assignment: Admin, Directors, Director Cement, Head of Ticketing.

Assignable contracting staff include `Contracting`, `Contracting Head`, and `Contracting Cement`. Assignable ticketing staff include `Ticketing` and `Head of Ticketing`.

Assignments patch the query, mirror owner fields onto linked job cards, create assignment activity, notify assigned staff, and notify relevant heads. If ticketing is assigned or ticketing scope is not `Not required`, Head of Ticketing is included in head notifications.

Email and bell delivery intentionally differ for this event:

- Email goes only to the selected Contracting and Ticketing SPOCs through direct staff targeting.
- Relevant heads can still receive oversight bell rows.
- Head-role bell notifications use `emailRoles: []`, so they do not expand into department-wide or
  email-alert-role email recipients.

## Proposals and sales handoff

Contracting sends costing to Sales through Send to Sales. The query shows as With Sales, Sales receives an in-app notification, and Sales uses Sales Decision for confirm, revision, or lost.

Proposal cost price is per person and auto-calculated from land, airfare, and visa cost per pax. Contracting enters `visaCostPerPax`; manual CP entry is not part of the workflow. Tax supports 5%, 18%, or a custom rate.

Finalized PDF is separate from the sales proposal send action. Query rows keep Reference Itinerary editable; Finalized PDF actions are view/download-only from the linked proposal.

## Job-card creation

Order Confirmed alerts Accounts plus the assigned contracting, operations, and ticketing teams. Any Accounts team member can create a job card for a confirmed query, and Accounts Head/Admin/Directors/Director Cement can manage the job-card creator allowlist.

Job card numbers append the creator initials after the sequence number, for example `JC-0001-NS`.

After Accounts opens a job card, downstream teams are notified to start traveller master, ticketing, passport, visa, hotel/rooming, tour manager, and finance work.

## Travel series and travel batches

The portal UI labels the query option as Travel in Series. Backend fields, table names, and spreadsheet columns still use travel batch terminology.

A job card can have multiple travel batches. A travel batch can scope travellers, flight groups, and tour manager assignment. Tour manager calling board rows must filter by the traveller's batch when a job card is split.

Import behavior:

- A present Travel Batch column maps rows to that batch.
- An absent Travel Batch column preserves an existing traveller batch.
- A blank Travel Batch value clears the traveller batch.
- Modal unbatch sends `travelBatchId: ""`, not `undefined`.

## Traveller and passenger data

Traveller master and aligned lists filter by Job Card. They are not unscoped all-passenger views.

Traveller master includes gender (`Male` or `Female`) and passport expiry. Passport expiry display should use the same resolved date as exports, with critical/warning countdowns when expiry blocks or nears blocking travel relative to job start.

Linked-entity selects in portal forms should autofill dependent fields such as job card, traveller, PNR, query, visa, and related records.

## Spreadsheet imports and exports

Spreadsheet flows run through parser -> portal row mapper -> Convex validators -> import processor. Total row count is not capped. Passenger commit work is batched internally, but the user-facing upload can cover the whole workbook.

Passenger import/export supports:

- Travel Batch
- gender
- passport expiry
- per-job-card room summary on preview/commit

Traveller master, rooming, passport, visa, and ticketing templates include Travel Batch and gender where relevant.

Room type labels are canonicalized as Single, Twin, Double, Triple, Child with Bed, and Family Room. Legacy `SGL`, `DBL`, and `TPL` values map into the canonical labels.

Flight import/export uses a flight itinerary workbook grouped by job card and optional Travel Batch. `commitFlightImport` upserts flight groups and segments using import keys so repeated imports update existing rows instead of blindly duplicating them.

## Dashboard and list views

Portal dashboard summary data comes from `convex/crm/dashboard.ts` `getPortalSummary`. The dashboard uses role-aware persona slices, actionable KPI groups, drill-down links, and the shared period control.

List views use one sticky `PortalListToolbar` with compact titles, search, filters, date range, save-view actions, and filtered result counts. Saved views live in sidebar Pinned and the command palette, not as a persistent chip row.

The primary action for the current workflow remains visible. Secondary actions use an anchored
**More** dropdown, not a modal. Query rows keep Sales Decision or the relevant workflow action
visible; Edit query, Reference Itinerary, Assign teams, and Delete live under More. Traveller,
Ticketing, Flights, Hotel/Rooming, Passport, and Visa keep their create action visible and place
secondary import/export actions under the toolbar More menu.

Shared data tables show 25 loaded rows per page. Selection can span pages; the visible select-all
control applies only to the current page. Replacing rows after filters or search returns to page 1,
while appending another server cursor page preserves the current page. When more authorized server
records exist, the list exposes a separate **Load more records** action.

Date ranges are stored as ISO values and displayed as DD/MM/YYYY. Inverted From/To ranges must error and skip filtering; they should not silently swap.

The Pipeline page is available when the user can manage queries or view contracting.

## Notifications

Bell notifications and email notifications are separate. Bell rows target exact roles or auth users; email expansion resolves staff email addresses and can include department heads.

Unread state changes only when a user clicks a notification. Opening the bell dropdown or Activity panel must not mark rows read.

Notification deep links use `?open=` and `?id=`. Email detail rendering is centralized in `convex/crm/notificationEmailDetails.ts` so entity-specific emails can include useful context for queries, job cards, flights, expenses, leave, and tour manager assignments.

## Leave

Leave approvals are two-stage:

1. The designated leave head approver approves first.
2. HR/final authority approves second.

One approval must never complete both stages. HR does not approve the head stage unless HR is the assigned head approver or an Admin/Director override is being used.

Leave head approver defaults come from staff profile or leave matrix data, with a manual staff override still available. The Settings allowlist hides Sync leave approvers from matrix, but the matrix-backed column and manual override remain part of the model.

Unused Casual/Sick leave lapses automatically on 31 March IST through `convex/crons.ts` -> `convex/crm/leaveLapse.ts`; HR can also run the lapse manually.

## Expenses and files

Every staff user with a portal role can view and create expenses. Tour Managers can manage their own expenses. Finance can approve expenses.

Expense files use Convex storage and authenticated same-origin portal file routes. The same pattern applies to query/proposal files and finalized proposal PDFs. Browser-visible Convex storage URLs should not be exposed for portal documents.

Expense form labels should use Category with the `Select category...` placeholder. Do not reintroduce Expense Head terminology in portal forms.

## Portal chrome

Portal z-index values are centralized in `src/lib/portal/zIndex.js`.

The header renders the signed-in Google profile image when available and falls back to the user
icon. The shell uses the existing `/gallery/bgfooter.webp` texture at low opacity so light pages
retain the established Citius visual language. Finance, Ticketing, dashboard, and other metric
cards use fluid grids rather than fixed-width legacy cards, and entity forms share the sectioned
hierarchy introduced by the Sales Query form.

Current ordering principles:

- Sticky list toolbar stays below header chrome.
- Bell and notification dropdowns sit above toolbar blur.
- Command palette blurs main content only, not the sidebar.
- Toasts sit above modals so validation feedback stays visible.
- Confirm dialogs stay above toasts.

The command palette result list scrolls and skips open/close animation. Sidebar shortcut submenus must stay closable even on the active route, and the sidebar must scroll when nav is expanded so the mod-key footer hint never overlaps open menus.
