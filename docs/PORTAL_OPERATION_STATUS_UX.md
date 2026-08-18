# Staff Workspace operation-status UX

This is the permanent user-experience contract for durable passenger-family import/export,
reconciliation, focused list detail, Job Card deletion progress, and Activity email-delivery status.
The source was characterized at the implementation revision; source-observed behavior and unproven
browser behavior are kept distinct. Backend operation status, bell-notification status, and email
delivery status are separate domains.

## Shared presentation contract

- An operation is owned by its durable server record, not by an open dialog. Closing an import or
  export dialog never cancels its worker. Reopening reattaches the current authorized user to the
  recent operation for that kind and Job Card.
- Retry preserves the identity named below. A retry must not create duplicate rows, restart a
  completed source cursor, expose a raw storage URL, or imply that partial work is complete.
- Passenger-family workbooks remain uncapped in total rows; internal batches/pages stay bounded.
- Status surfaces disclose Job Card code, counts, stage, and privacy-safe error summaries only. They
  do not disclose passport values, storage IDs, recipient addresses/hashes, provider bodies,
  deployment IDs, or secrets.
- Actions remain ordered as context/status first, then secondary Close/Cancel or download/report,
  then the primary start/retry/done action. At 390px actions wrap without changing that reading or
  keyboard order; long messages wrap and status is never color-only.
- Operation progress uses polite announcements because it can update repeatedly. A newly submitted
  error is assertive or receives focus once; it must not reannounce on every clock tick. Dialog
  focus trapping/restoration belongs to the shared controlled-dialog primitive. Reduced motion
  changes transition treatment, never state availability or action order.

## State vocabulary

| State | Unambiguous meaning | User action and ownership |
| --- | --- | --- |
| `loading` | Source parsing, Preview preparation, focused-detail fetch, or a command request is pending | Wait or close when allowed; Save/Generate/Upload stays disabled when authority data is incomplete |
| `empty` | No selected source/current operation, no focused record, or no delivery events | Select required input, start new work, or accept the explicit empty message; never render a false zero-complete result |
| `running` | Durable work has unresolved bounded units and is still reporting progress | Wait or close/reopen; do not start a duplicate command |
| `partial` | Work/reconciliation is terminal for the current attempt but some rows or counts remain failed, unresolved, legacy, or not fully reconciled | Review row/count evidence; correct terminal data or resume only retryable work |
| `stalled` | A running operation has not advanced for more than the exact two-minute threshold | The authorized retry owner resumes the same identity; ordinary observers escalate rather than inventing a new operation |
| `failed` | The command/worker stopped and did not reach its complete outcome | Read the privacy-safe reason, then retry with the preserved identity or correct the named input |
| `completed` | All required work is terminal and successful; any expiring artifact is currently available | Review reconciliation or download the private artifact; starting new work is a separate explicit action |
| `expired` | A completed export artifact reached its 15-minute lifetime and is no longer downloadable | Generate a new private export; no storage bypass exists |
| `retrying` | Email delivery is in bounded automatic backoff and no terminal outcome is claimed | Oversight roles monitor; the scheduler owns the retry |
| `skipped` | Email delivery was deliberately not attempted for that recipient outcome | No retry unless the underlying targeting/configuration decision changes |
| `exhausted` | Email delivery used its bounded retry allowance without success | An authorized operator investigates; a bell notification is not thereby marked failed |

## Screen and state matrix

| Surface/state | What the user sees | Primary and secondary action | Retry, close/reopen, and completion evidence | Accessibility status |
| --- | --- | --- | --- | --- |
| Passenger import `loading` | Busy summary while file parsing/Preview or Upload is pending; affected controls are disabled | Wait; Cancel remains the exit when safe | No durable retry until an operation exists; local progress is not completion | Source-observed; progress copy is visible, but assertive error announcement remains unproven |
| Passenger import `empty` | Job Card/file inputs and zero/placeholder summary; no operation panel | Select Job Card and workbook | No worker exists | Source-observed; authenticated 390px and focus-return browser cells unproven |
| Passenger import `running` | Job code, raw running status, completed/total batches, processed and failed row counts | Wait; Cancel closes the dialog | Worker continues; reopen reattaches through the stable source digest and recent-operation query | `aria-live="polite"` source-observed; repeated-announcement browser cadence unproven |
| Passenger import `stalled` | “Progress paused” guidance | Re-select the same file to resume safely; Cancel closes | Same source digest/batch identities resume; exact threshold is two minutes plus one millisecond | Polite region source-observed; keyboard resume browser cell unproven |
| Passenger import `partial` | Partial result message plus reconciliation counts/failed rows | Review reconciliation; Download CSV; Done | Retryable work keeps identity; terminal rows require corrected source | Reconciliation dialog/source tests exist; row-table screen-reader and 390px checks unproven |
| Passenger import `completed` | Success toast, completed operation counts, and reconciliation | Review/Download CSV, then Done | Durable counts are completion evidence; raw workbook content is not retained as status evidence | Mounted reconciliation coverage exists; nested-dialog focus return unproven |
| Passenger import `failed` | Inline command/parse/Preview error; durable row failure is represented as partial, not false complete | Correct input or retry the same source | The current UI has no separate durable terminal `failed` import status | Source-observed gap: inline error alert/focus behavior needs a separate implementation ticket |
| Passenger export `empty` | “Not started,” zero rows, selected/no selected Job Card | Generate Spreadsheet after Job Card selection; Cancel closes | A UUID command is created only on start | Source-observed; authenticated mobile cell unproven |
| Passenger export `running` | “In progress,” processed row count, and explicit permission to close | Wait or Cancel/close | Reopen shows persisted cursor progress; duplicate generation is disabled | Polite live region source-observed |
| Passenger export `stalled` | “Needs retry” and stopped-progress explanation | Retry Export; Cancel closes | Retry reuses the same command ID and durable cursor | Boundary/unit tests exist; authenticated keyboard retry unproven |
| Passenger export `failed` | Failed status and privacy-safe generic reason | Retry Export | Retry reuses command ID; failure does not expose provider/storage detail | Source-observed; inline command error alert/focus remains unproven |
| Passenger export `completed` | “Ready,” row count, Download Spreadsheet, and Generate New | Download Spreadsheet; Generate New is a separate primary command | Same-origin reauthorized download is completion proof, not the storage ID | Mounted download test exists; private deployed download is separate target-bound proof |
| Passenger export `expired` | Expired explanation | Generate Again | A new command creates a new artifact; old storage is inaccessible | Fixed-time expiry tests exist; live 15-minute browser transition unproven |
| Focused list detail `loading` | “Loading the current record”; form save is disabled | Wait or close | A compact list row is not accepted as edit authority | Mounted loading test exists; dialog focus/browser latency cell unproven |
| Focused list detail `empty` | “Record no longer available”; save remains disabled | Close and return to list | Missing authoritative detail cannot become an empty editable form | Mounted missing-record test exists |
| Job Card deletion `running` / `stalled` | Up to three current-user operations, current stage and removed count; stalled copy asks for admin help | Observe or contact Admin | Background cleanup survives navigation; Admin owns safe retry | Region is labelled and each row is `role="status"`; the coarse clock runs only while this route surface is active |
| Job Card deletion `completed` / `failed` | Green completion or red stopped panel with privacy-safe summary | No action or contact Admin | Durable stage/counts are evidence; only three newest are visible | Mounted running/complete/failed role-status test exists |
| Activity email `empty` | “No email delivery events yet” | No action | Empty means no visible authorized summaries, not that bell delivery is complete | Mounted deterministic empty test exists |
| Activity email `running` / `retrying` | In-progress and retrying count chips grouped by event | Monitor permitted origin; scheduler owns retry | Counts derive from monotonic ledger projection | Polite region and mounted count test exist; update cadence screen-reader smoke unproven |
| Activity email `partial` | Amber notice says counts are still reconciling and “currently counted” replaces “total” | Monitor; do not infer completeness | A second verified reconciliation pass is required for complete coverage | Mounted partial-copy test exists |
| Activity email `completed` / `skipped` / `exhausted` | Sent, skipped, and exhausted counts; permitted origin link when available | Follow origin or escalate exhausted delivery | Terminal email state does not alter bell read state; opening Activity marks nothing read | Permission/return tests and privacy-safe mounted tests exist; least-privilege browser cells unproven |

## Permission and privacy matrix

| Surface | Visibility / retry owner | Privacy boundary |
| --- | --- | --- |
| Import | Caller must retain the kind's manage permission and Job Card scope; same initiating actor/source resumes | Counts, kind, Job Card and safe row messages only; no protected source payload in operation summary |
| Export | Caller must retain the kind's view permission, Job Card scope, and initiator identity; initiator retries/downloads | Same-origin private route; no raw storage URL or storage ID |
| Reconciliation | Import-authorized initiator reviewing the just-returned durable result | Row number, traveller display name, disposition, safe message; CSV inherits that boundary |
| Focused detail | Existing entity view/manage permission; save authority remains server-side | Full detail is fetched only for the selected authorized record |
| Job Card deletion | Manage Job Cards initiator observes; Admin/operator owns retry | Job code, stage, counts, privacy-safe failure summary |
| Activity email | `view:emailDeliveryStatus`: department heads, Admin, Directors, Director Cement, further scoped to visible origin | Aggregated counts and permitted origin only; never address, hash, content, provider body, or secret |

## Evidence map and unproven cells

| Contract area | Current automated evidence |
| --- | --- |
| Import/export modal gating and completed download | `src/components/portal/workspace/modals/PortalSpreadsheetModals.mounted.test.jsx` |
| Reconciliation pagination/report | `src/components/portal/workspace/modals/ImportReconciliationModal.mounted.test.jsx` |
| Explicit operation clock, stall and expiry boundary | `src/components/portal/workspace/usePortalReferenceClock.mounted.test.jsx`, `convex/crm/operationTimePolicy.test.ts` |
| Focused detail loading/missing authority | `src/components/portal/EntityModal.mounted.test.jsx`, `src/lib/portal/modalLifecycle.test.js` |
| Job Card deletion state | `src/components/portal/workspace/portalOperationsViews.mounted.test.jsx` |
| Activity delivery empty/partial/retrying/skipped/exhausted | `src/components/portal/workspace/admin/ActivityView.mounted.test.jsx` |
| Role and privacy return contracts | `convex/crm/notificationEmailLedger.test.ts`, `convex/crm/passengerExportOperations.test.ts`, `convex/crm/importFacade.test.ts` |

No authenticated desktop/390px least-privilege browser matrix, screen-reader announcement smoke,
live interruption/takeover, private download/expiry, or cleanup run was performed for this source
change. Those cells are explicitly unproven and require a separately authorized, exactly identified
non-production frontend and Convex deployment. Source tests are not Production evidence.

Source-observed follow-up gaps—import/export inline error announcement and focus, nested
reconciliation focus return, long-row table behavior at 390px, and Activity live-region cadence—must
be handled as separate implementation tickets after browser characterization. This document does not
silently redefine those gaps as already implemented.
