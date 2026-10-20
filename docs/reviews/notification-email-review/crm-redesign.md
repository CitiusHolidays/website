# A simpler Citius Connect

The CRM now uses a compact sidebar, flat page headings, quieter fields and tables, and one prominent row action with the other actions in More. The public site and Customer Account keep their own presentation. U01 to U05 remain in the [earlier usability review](site-usability.md).

These pictures show actual Citius components and CSS with fictional staff and trips. API transport, authentication, Next navigation and image delivery use local substitutes. They do not prove a real signed-in session or provider acceptance. Business stages, permissions, approval authority, required fields, calculations and deletion confirmations stay in place.

## U06. A quieter workspace

The main reference is [Augustas's Northwind Ops](https://x.com/augustasdesign/status/2109844574613200974). Its actual archived image is 960 by 1200 pixels. The sidebar crop is x=0, y=0, width 341, height 1200, normalized to 280 pixels wide. Citius closely follows its light rail, outlined active row, muted icons, group spacing and right-edge count. It retains the Citius logo, configured fonts, destinations and role visibility. Desktop rows are 36 pixels tall; phone controls remain 44 pixels.

![Actual source crop beside the Citius sidebar](crm/sidebar-comparison.png)

Search commands opens the existing working command palette. Screens without that palette show neither a nonfunctional search control nor its shortcut hint. The user's supplied Library image libfile_80621dfeaed88191ae1d6d9720059d78 shows a gray number at the row's right edge. The orange dot beside it comes from the separate activity request. No Runs destination was added.

| Before | After |
| --- | --- |
| ![Earlier query composition](crm/queries-1440-before.jpg) | ![Flat header and compact table toolbar](crm/queries-desktop.jpg) |

The query table puts Stage before secondary columns. Pinned cells are opaque, so underlying text cannot bleed through. Columns and the 44-pixel scroll buttons share one compact row. This removes the redundant control row above the table. Inner horizontal scrolling is intentional; every column remains available.

The table reference is [Akash's table](https://x.com/a1x45h/status/2103785018636329085), actual 900 by 1200 image, crop x=469, y=130, width 431, height 520. The comparison uses actual source pixels. Citius follows its quiet header, thin rules and compact controls. It retains its business columns, status colors and named actions.

![Actual table region beside the Citius table](crm/table-comparison.png)

The form reference is [Intent UI's grid fieldset](https://design.intentui.com/patterns/fieldset/with-grid-layout), from bookmarked designer Irsyad. The actual light-browser crop is x=532, y=290, width 540, height 320 at 1280 by 720. Citius closely follows its white outlined fields, 8-pixel corners, labels above fields, grouped two-column layout and full-width notes. Business content requires a wider form and 44-pixel controls. Existing labels, validation and values remain.

![Actual fieldset region beside the Citius proposal form](crm/form-comparison.png)

Buttons follow the [Intent UI primary button](https://design.intentui.com/patterns/button/primary), actual crop x=740, y=410, width 120, height 76. The [menu-action table](https://design.intentui.com/patterns/table/with-menu-actions) supports the primary-action/More arrangement. Citius retains navy for the explicit primary action and quiet outlined secondary controls. No component library was installed or paid source accessed.

![Actual button source region](crm/button-reference.png)

The second Northwind Ops image supplies the detail reference. Its actual 960 by 1200 image is cropped x=534, y=0, width 426, height 860. Citius follows the unboxed title, labeled facts and separated work modules. Its Job Card readiness map, tasks and document access are retained, so this is a detail-layout adaptation rather than a 1:1 screen copy.

![Actual detail region beside the Citius Job Card](crm/detail-comparison.png)

Cards remain around distinct content. The collapsed Job Card checklist no longer stretches into a large blank card beside the longer next-actions list. Post-tour selectors sit on the page, and report/form cards use the same restrained corners as the CRM.

The earlier notification centre used Nick's compact Unread/All centre, Rico's activity separation and Augustas's secondary status view as adaptations. U01 to U05 retained the existing Citius presentation. These are the exact sources for the later CRM shell and content work; no claim of 1:1 copying applies to unrelated screens.

## U07. Keep a pending save safe

Save remains explicit. While a command is pending and during its short saved feedback, the form blocks late edits, duplicate submits, closing and replacement by another form. Failure retains the draft and restores explicit retry. Native inputs and custom linked-query, role and extra-alert checkboxes all reflect the disabled state.

The proposal retains its linked queries, cost calculation, selling price, tax, itinerary and document workflow. The phone dialog matches the viewport and scrolls internally. The footer stays visible. Keyboard navigation reaches the last itinerary field above it; Tab from Save wraps to Close. Escape closes an idle dialog. These are viewport screenshots, not captures beyond the fixed overlay.

| Phone, top | Phone, final fields |
| --- | --- |
| ![Proposal at 390 pixels](crm/proposal-mobile.jpg) | ![Itinerary above Save](crm/proposal-bottom-mobile.jpg) |

[Narrow 360-pixel viewport](crm/proposal-360.jpg). At 390 by 844 and 360 by 780, the root scroll stayed locked and the document had no horizontal overflow.

| Pending | Failed save |
| --- | --- |
| ![Fields and linked-query checkboxes disabled](crm/proposal-saving-390.jpg) | ![Error with values retained and editing restored](crm/proposal-error-390.jpg) |

## U08. Carry the selected Job Card into a new form

A new operational form starts with the explicitly selected Job Card only when it remains available in the loaded choices. Explicit record links, edits and linked-traveller context take precedence. Office expenses keep their existing meaning. This saves repeated selection; it does not create or submit a record. Regression checks cover seven operational form kinds and rejected or unavailable context.

## U09. Workload and new activity

The gray number means outstanding work in that destination's existing workflow. The orange dot means relevant arrivals since that person last opened the loaded destination. Opening the link clears only the captured activity. It preserves the workload count, inbox read state and business records. A later arrival restores the dot. The whole row is clickable; New activity has an accessible label and no animation.

![After opening Queries, its count remains two and its dot clears](crm/queries-opened-desktop.jpg)

![Phone navigation uses the same count and dot](crm/sidebar-mobile.jpg)

Counts are established for Queries, Contracting, Draft Proposals, open assigned or unallocated Job Cards, Tickets needing attention, and the Ticketing overview. Current assignment, record access, role visibility and active staff determine scope. Unassigned work appears for the relevant heads. Overlapping assignments count once. Other destinations have no fabricated count.

Reads are bounded. A complete count shows its number. A positive incomplete count shows at least that number. An incomplete zero shows an ellipsis with an accessible explanation, rather than claiming there is no work.

Activity persists per person and destination, outside the bell's limited recent feed. Thirty unrelated notices cannot evict it. The real controlled notification publisher records it atomically, using current authorized recipients and record access. Disabled bell controls create no new marker. Existing bell history is not backfilled. The new table is code only; no target migration or deployment was run.

Activity records a historical arrival. If work later closes or moves to someone else, the workload count changes; the arrival dot can remain until that person visits. A proposal sent to its assigned Sales owner can therefore produce a dot with no Draft proposal count. Acknowledgement checks current route permission and staff identity. Hover, prefetch, failed navigation and merely rendering the sidebar do not acknowledge it. An exact captured ID prevents an old acknowledgement from clearing a newer arrival.

## U10. Find the next commercial action

Proposal rows show Send to Sales when the existing Draft and linked-query rules permit it. Files, Edit, collaborator sharing and Delete remain in More. Contracting rows show Assign for unallocated work when allowed, otherwise their existing Status action. Every permission check and exact record/revision target remains. Delete still reaches its existing confirmation.

| Proposal rows | Contracting on a phone |
| --- | --- |
| ![Compact handoff and visible status](crm/proposals-1440.jpg) | ![Assignment and other actions remain reachable](crm/contracting-390.jpg) |

[Open Proposal action menu](crm/proposal-actions-1440.jpg). Mounted checks exercise the actual actions, exact targets and read-only Files-only access. They also retain the heads' allocation path. No new approval power or workflow stage was added.

## U11. Keep the person fixed while saving travel

The actual travel form left Person enabled while its other fields and Save paused. It now disables Person too. A failed save restores the selected person, destination and dates for explicit retry. Permissions, Job Card linking and mutation meaning are unchanged.

| Before, during save | After, during save |
| --- | --- |
| ![Person was still enabled](crm/travel-person-before.jpg) | ![Person now pauses with the submitted draft](crm/travel-person-after.jpg) |

[Failed-save recovery](crm/travel-failure-390.jpg). This was reproduced through the actual component with a deferred synthetic mutation. It is browser evidence, separate from the backend travel tests.

## Staff journey coverage

The [59-route inventory](site-coverage.json) retains checked, changed, unchanged and limited areas. The shared shell reaches CRM routes; the populated cases below provide deeper evidence only for their named components.

| Journey | Existing sequence and invariants | Improvement or justified retention | Evidence |
| --- | --- | --- | --- |
| Sales create/edit | Required enquiry and owner data, save, explicit Contracting handoff, Sales-owned decision. | U06 grouped presentation, U07 draft protection, compact row actions. No extra questions or automatic handoff. | [Query form desktop](crm/form-query-1440.jpg), [phone](crm/form-query-390.jpg), pilot/save/lifecycle tests. |
| Contracting proposal/revision | Link Queries, prepare costs/itinerary/document, explicit revision-bound Sales handoff. | U06 groups, U07 safety and U10 compact actions. Pricing completeness, tax and confirmation meanings unchanged. | [Proposal desktop](crm/proposal-desktop.jpg), [phone](crm/proposal-mobile.jpg), exact-payload/action tests. |
| Heads assign/reallocate or work | Authorized head chooses department SPOCs, can select self, explicit save. | Existing selectors and guards retained. U07 prevents draft changes during pending allocation. No invented approval role. | [Assignment desktop](crm/form-assignQueryTeams-1440.jpg), [phone](crm/form-assignQueryTeams-390.jpg), existing assignment/role suites and mounted allocation action. |
| Operations Job Card/documents | Accounts opens only from Confirmed Offer; authorized staff view context, documents, readiness and checklist, then perform existing work. | Flat heading and fact layout; U08 carries selected context. Readiness calculations, document access and task completion remain. | [Detail desktop](crm/jobDetail-1440.jpg), [expanded tasks](crm/jobDetail-expanded-1440.jpg), [phone](crm/jobDetail-390.jpg), command-centre/lifecycle/backend suites. |
| Traveller documents | Choose Job Card/person, enter required travel/document data, explicit save. | U06 grouped fields, U07 draft safety, U08 reliable context. No identity or document-access expansion. | [Traveller desktop](crm/form-traveller-1440.jpg), [phone](crm/form-traveller-390.jpg), existing modal/operations suites. |
| Ticketing flight/PNR/ticket | Retain PNR, seats, itinerary/person links and explicit issue/change/refund actions. | Quieter forms/list, current actionable count and loaded-ready activity handling. Ticket status, allocations and calculation meaning unchanged. | [PNR phone](crm/form-pnr-390.jpg), [ticket phone](crm/form-ticket-390.jpg), [list](crm/tickets-1440.jpg), mounted Ticketing and scoped-audience tests. |
| Finance expenses/approvals | Explicit expense/proof submission, existing manager/Finance approval and reimbursement sequence. | Shared form/list presentation and context prefill. Amounts, authority and approval outputs retained. | [Expense phone](crm/form-expense-390.jpg), [expense list](crm/expenses-1440.jpg), [approvals](crm/approvals-1440.jpg), existing finance suites. |
| HR leave | Existing request, head/HR/final decision stages and authority. | Presentation only; no routing or authority change. No general Management copy rule added. | [Leave form](crm/form-leave_create-390.jpg), [list](crm/employees-on-leave-1440.jpg), mounted two-stage/final-authority regression and backend suites. |
| Staff travel | Choose person, dates, destination and optional Job Card, explicit save. | Flat heading and U11 pending-person fix. No automatic assignment or record creation. | [Desktop](crm/staffTravel-1440.jpg), [phone](crm/staffTravel-390.jpg), failure recovery above and backend travel suite. |
| Manager profiles/history | Existing profile and assignment history, explicit management actions. | Flat page heading and shared field presentation. Experience and completed-tour meanings retained. | [Desktop](crm/externalManagers-1440.jpg), [phone](crm/externalManagers-390.jpg), existing manager-profile suite. |
| Post-tour feedback | Choose authorized Job Card; preserve separate traveller responses and manager reports, explicit save/upload/delete confirmation. | Flat selector and consistent report cards. No invitation, upload or deletion executed against a provider. | [Desktop](crm/postTour-1440.jpg), [phone](crm/postTour-390.jpg), existing mounted/backend feedback suites. |

Dashboard, inbound/event tools and other routes inherit the CRM shell where used, but are not claimed as independently accepted signed-in journeys. Public/Account usability remains U01 to U05; their visual identities stay separate. Parked PRs and rejected product features remain parked. No analytics was enabled.

## Verification and limits

The [current inbox gallery](inbox-review.md) adds desktop and phone pictures from the Mac browser, including Unread/All, the bell and failure states. It also records the existing test-account discovery and the inaccessible, mismatched preview binding. No current signed-in target acceptance is claimed.

[Browser evidence](crm-browser-evidence.json) identifies current image hashes and substitutes. The [loading state](crm/queries-loading-1440.jpg), [empty state](crm/queries-empty-1440.jpg) and failed-save pictures are distinct. Earlier before pictures use the pre-redesign components; some have fewer sample rows than the populated final pictures. Compare composition, not those sample business outcomes.

[Six controlled mutations](crm-mutation-evidence.json) caught stale server acknowledgement, missing real-publisher projection, a moving client snapshot, enabled pending checkboxes, missing Job Card prefill and a lost Proposal revision. Every original file was restored byte-for-byte and its focused suite passed afterward. These are separate from the four earlier U01 to U05 mutations and ordinary passing tests.

The final local gate passes with Effect 4.0.5: 2,055 Bun tests, 225 schema-backed Convex tests, zero-warning lint, application/Convex types, and coverage for six high-risk files and 29/29 branch contracts. The existing dead-code check passes at 132/183 reviewed findings, with no baseline update. Diff hygiene passes. The PR records the exact published revision and hosted result separately.

The first upgrade run correctly rejected the old dependency-closure fingerprint. The existing repository calculation refreshed it, without weakening its test. A later React Doctor check found the compiler limitation described below; the complete local gate passed again after that fix.

React Doctor's changed-code check now has zero errors and seven advisory notes. Its unsupported `finally` clause was replaced by explicit pending-save resets on success and failure; the actual save/retry tests pass. No diagnostic rule or baseline was weakened. Advisory notes concern array iteration/lookups, sequential fixture setup and deliberate callback identity for the readiness subscription.

The dependency audit reports existing advisories in ten packages: brace-expansion, braces, DOMPurify, follow-redirects, KaTeX, Next.js, sharp, source-map-js, undici and Vite. Their installed versions match the pre-change lockfile, and the audit lists no Effect advisory. This is an audit failure for the existing dependency set, not a clean dependency-security result or an assessment of application reachability. Unrelated package upgrades are outside this Effect update.

The existing ignore rules already cover the local fixture, caches, logs and test outputs. No new ignore rule is warranted. Intended source, regression tests, these reference crops and review pictures remain tracked.

No native Next build, authenticated non-production acceptance, provider acceptance, deployment or migration is proved by these component checks. No real record, email, charge or live control was used. The draft grants no merge or production deployment authority.
