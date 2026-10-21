# Pictures of the changes

The new email design and the changed app screens are collected here. Each picture uses fictional people and trips. The public site, Customer Account and Staff Workspace keep separate designs and permissions.

The newest pictures below come from the real local app, signed in with the designated test accounts. The final run passed all 16 selected checks. Earlier component pictures remain useful for populated layouts, loading and deliberate failures. They use substituted transport and are labelled as such. Neither kind of picture proves production configuration or mailbox delivery.

Some signed-in pictures retain Next's small "N" development-tools indicator at the bottom left. It can overlap the edge of a control, including Hotel Cancel. It is a local development overlay, not part of Citius or a production capture. No application error was erased from these pictures.

## The emails

Workflow updates, account verification, password reset and website enquiries now share the Citius header, readable details, one main action and a visible fallback link. The plain-text version keeps labels and values readable too.

| Workflow update | Verification |
| --- | --- |
| ![Contracting assignment email](emails/query-phone.png) | ![Account verification email](emails/verification-phone.png) |

The [complete email gallery](email-review.md) has desktop and phone renders of all 17 workflow detail sets, both authentication messages, website enquiries and missing-details or long-content cases. These 46 pictures render actual template HTML. No email was sent. Staff password setup uses the password-reset template. Reminders use the corresponding workflow details and their existing event wording.

## Sidebar, lists and search

The sidebar keeps every permitted destination. A gray count means outstanding work. An orange dot means relevant activity since the person last opened that destination. Opening the loaded destination clears the captured dot without completing work or reading inbox items. A later arrival restores it.

| Signed-in Query list | On a phone |
| --- | --- |
| ![Actual Query list with compact toolbar and pinned actions](actual/queries-desktop.png) | ![Actual Query cards and primary actions on a phone](actual/queries-phone.png) |

| New activity beside the work count | Phone navigation |
| --- | --- |
| ![New assigned activity in the sidebar](actual/inbox-sidebar-new-desktop.png) | ![Work count and new-activity dot in the phone drawer](actual/sidebar-count-activity-phone.png) |

Search commands opens the existing command palette. Columns keeps the existing field choices. The account menu keeps the existing destinations and sign-out action.

| Commands | Columns | Account menu |
| --- | --- | --- |
| ![Actual command palette](actual/commands-desktop.png) | ![Actual column chooser](actual/columns-desktop.png) | ![Actual account menu](actual/account-menu-desktop.png) |

![Commands on a phone](actual/commands-phone.png)

The earlier [filter before and after](site-usability.md#u01-clear-staff-filters-without-opening-another-panel) shows the visible Clear filters action. [Query loading](crm/queries-loading-1440.jpg) and [empty results](crm/queries-empty-1440.jpg) are separate component states. Proposal, Contracting, Tickets, Expenses, Approvals and Leave lists retain their populated desktop and phone pictures in the inventory below.

## The inbox and bell

Unread and All share one inbox. Opening the bell or changing the filter preserves unread items. Opening one item reads only that item and loads the authorized work. The signed-in test inspected the exact audience across all 12 designated staff profiles before reassignment.

| Actual inbox | Actual bell |
| --- | --- |
| ![Signed-in Contracting inbox](actual/inbox-unread-desktop.png) | ![Bell preserves both unread assignments](actual/inbox-bell-desktop.png) |

| All on a phone | The opened Query |
| --- | --- |
| ![Read history and remaining unread assignment](actual/inbox-all-phone.png) | ![The assignment opens its authorized Query](actual/inbox-query-deep-link-desktop.png) |

The [inbox state gallery](inbox-review.md#empty-loading-and-failed-requests) also shows no history, all caught up, loading and a failed read. Those deliberate failure examples use component substitutes. The separate staff and authorized email-status views are pictured there too.

## Commercial and operational forms

The existing sequence remains Query, assigned preparation, Proposal, Sales decision, confirmed offer, then Job Card. Required fields, costing, tax, documents and authority stay the same. Save remains explicit. Pending saves pause edits; failed saves keep the draft for retry.

| Query | Proposal | Team assignment |
| --- | --- | --- |
| ![Query form on a phone](crm/form-query-390.jpg) | ![Proposal form on a phone](crm/proposal-mobile.jpg) | ![Assignment form on a phone](crm/form-assignQueryTeams-390.jpg) |

The [Proposal gallery](crm-redesign.md#u07-keep-a-pending-save-safe) shows the desktop form, narrow phone, final itinerary fields, pending state and failed-save recovery. The real local workflow passed creation, handoff, revision, confirmation and Job Card creation. The head self-assignment test saved and reopened the head's own Ticketing assignment.

![The actual head taking their own assignment](actual/head-self-assignment-desktop.png)

The selected Job Card carries into seven operational form kinds only when it is still a valid choice. Edits and explicit record links take precedence. It does not create or submit anything.

| Hotel | Seat allocation | Visa |
| --- | --- | --- |
| ![Actual hotel form on a phone](actual/hotel-form-phone.png) | ![Actual seat form on a phone](actual/seat-form-phone.png) | ![Actual visa form on a phone](actual/visa-form-phone.png) |

These three signed-in form checks opened and cancelled without saving. Visa uses the shared presentation but is not one of the seven Job Card-prefill kinds. Traveller, PNR, Ticket and Expense forms have their desktop and phone pictures below. Invoice uses the same form controls; its context-prefill behavior has a regression check, rather than a separate invoice-creation claim.

## Job Cards, Ticketing and custom workspaces

| Job Card details | Staff travel | Post-tour work |
| --- | --- | --- |
| ![Job Card details on a phone](crm/jobDetail-390.jpg) | ![Staff travel on a phone](crm/staffTravel-390.jpg) | ![Post-tour feedback on a phone](crm/postTour-390.jpg) |

These populated component pictures use fictional responses. Job Card readiness, checklist completion, travel ownership and post-tour meaning remain. The travel failure picture below shows the retained draft. External manager profiles and the expanded Job Card checklist have separate pictures in the inventory.

| Actual Ticketing overview | On a phone |
| --- | --- |
| ![The signed-in Ticketing overview with no tickets yet](actual/ticketing-overview-desktop.png) | ![The same empty overview on a phone](actual/ticketing-overview-phone.png) |

The local overview is empty because this selected run created no tickets. The [populated Ticket list](crm/tickets-1440.jpg) is a component example. Earlier signed-in Ticket creation and edit checks remain in the [local workflow record](local-acceptance.md). This distinction avoids presenting sample component rows as backend data.

## Account, Contact and Services

Account editing starts from the displayed details. Moving between tabs retains the draft; Cancel does not save it. The real signed-in test changed a draft name, switched tabs, confirmed the draft remained and cancelled.

| Actual Account draft | On a phone |
| --- | --- |
| ![Customer profile draft at desktop width](actual/customer-profile-draft-desktop.png) | ![The same retained draft on a phone](actual/customer-profile-draft-phone.png) |

The public Contact form comes before office maps on a phone. While sending, it protects the submitted values. A failure keeps them for retry. Services keeps its circular selector, with every choice reachable on narrow screens and by keyboard.

| Contact while sending | Mobile Contact order | Services |
| --- | --- | --- |
| ![Enquiry values protected during sending](u03-sending-mobile.png) | ![Form before the retained office maps](u04-after-mobile.png) | ![Services fit the phone width](u05-after-390.png) |

These public-state pictures use actual components with substituted requests. [U01 to U05](site-usability.md) retain the before pictures, desktop views and failure or pending states. No public enquiry was sent during the signed-in run.

## Picture and state inventory

| Changed screen or state | Desktop picture | Phone picture or explanation |
| --- | --- | --- |
| Query list, table, pinned cells and row actions | [Signed in](actual/queries-desktop.png) | [Signed in](actual/queries-phone.png) |
| Filters active and clear | [After](u01-after-desktop.png) | [After](u01-after-mobile.png) |
| Loading and empty lists | [Loading](crm/queries-loading-1440.jpg), [empty](crm/queries-empty-1440.jpg) | Shared list state. Component transport supplies the state; no separate phone failure claim. |
| Command palette | [Signed in](actual/commands-desktop.png) | [Signed in](actual/commands-phone.png) |
| Column chooser and account popover | [Columns](actual/columns-desktop.png), [account](actual/account-menu-desktop.png) | Existing phone navigation/account focus checks passed in the earlier 28-check run. Columns is a desktop-table control. |
| Sidebar count and dot | [Signed in](actual/inbox-sidebar-new-desktop.png) | [Signed in](actual/sidebar-count-activity-phone.png) |
| Personal inbox and bell | [Inbox](actual/inbox-unread-desktop.png), [bell](actual/inbox-bell-desktop.png) | [All](actual/inbox-all-phone.png), [bell component](inbox/inbox-bell-phone.png) |
| Inbox loading, empty, read history and failed read | [Role/status view](inbox/inbox-admin-desktop.png) | [Loading](inbox/inbox-loading-phone.png), [empty](inbox/inbox-empty-phone.png), [history](inbox/inbox-read-history-phone.png), [error](inbox/inbox-error-phone.png) |
| Query create/edit | [Form](crm/form-query-1440.jpg) | [Form](crm/form-query-390.jpg), [actual deep link](actual/inbox-query-deep-link-desktop.png) |
| Head assignment and self-assignment | [Actual persisted assignment](actual/head-self-assignment-desktop.png) | [Form](crm/form-assignQueryTeams-390.jpg) |
| Contracting and Proposal row actions | [Contracting](crm/contracting-1440.jpg), [Proposals](crm/proposals-1440.jpg), [More](crm/proposal-actions-1440.jpg) | [Contracting](crm/contracting-390.jpg), [Proposals](crm/proposals-390.jpg) |
| Proposal form, pending and error | [Form](crm/proposal-desktop.jpg) | [Form](crm/proposal-mobile.jpg), [last fields](crm/proposal-bottom-mobile.jpg), [360px](crm/proposal-360.jpg), [pending](crm/proposal-saving-390.jpg), [error](crm/proposal-error-390.jpg) |
| Job Card details and tasks | [Details](crm/jobDetail-1440.jpg), [expanded](crm/jobDetail-expanded-1440.jpg) | [Details](crm/jobDetail-390.jpg) |
| Traveller form | [Form](crm/form-traveller-1440.jpg) | [Form](crm/form-traveller-390.jpg) |
| PNR form | [Form](crm/form-pnr-1440.jpg) | [Form](crm/form-pnr-390.jpg) |
| Ticket list and form | [List](crm/tickets-1440.jpg), [form](crm/form-ticket-1440.jpg) | [List](crm/tickets-390.jpg), [form](crm/form-ticket-390.jpg) |
| Ticketing overview | [Signed in, empty](actual/ticketing-overview-desktop.png) | [Signed in, empty](actual/ticketing-overview-phone.png) |
| Hotel, seat and visa forms | [Hotel](actual/hotel-form-desktop.png), [seat](actual/seat-form-desktop.png), [visa](actual/visa-form-desktop.png) | [Hotel](actual/hotel-form-phone.png), [seat](actual/seat-form-phone.png), [visa](actual/visa-form-phone.png) |
| Expense and approval presentation | [Expense form](crm/form-expense-1440.jpg), [list](crm/expenses-1440.jpg), [approvals](crm/approvals-1440.jpg) | [Expense form](crm/form-expense-390.jpg), [list](crm/expenses-390.jpg), [approvals](crm/approvals-390.jpg) |
| Leave presentation | [Form](crm/form-leave_create-1440.jpg), [list](crm/employees-on-leave-1440.jpg) | [Form](crm/form-leave_create-390.jpg), [list](crm/employees-on-leave-390.jpg). Authority and routing are unchanged. |
| Staff role and extra-alert fields | Shared modal layout pictured above. | The pending-disabled multiselect behavior is covered by the mounted form tests. There is no new role-editor design or separate personnel acceptance claim. |
| Invoice or other inherited forms | Shared modal layout pictured above. | No distinct redesigned field group. Context-prefill kinds and precedence have tests. No extra business record was created for a picture. |
| Staff travel and failure recovery | [Desktop](crm/staffTravel-1440.jpg), [pending person](crm/travel-person-after.jpg) | [Phone](crm/staffTravel-390.jpg), [failure](crm/travel-failure-390.jpg) |
| External manager profiles | [Desktop](crm/externalManagers-1440.jpg) | [Phone](crm/externalManagers-390.jpg) |
| Post-tour workspace | [Desktop](crm/postTour-1440.jpg) | [Phone](crm/postTour-390.jpg) |
| Customer Account draft and pending save | [Actual draft](actual/customer-profile-draft-desktop.png), [component](u02-after-desktop.png) | [Actual draft](actual/customer-profile-draft-phone.png), [pending](u02-saving-mobile.png) |
| Contact form and submitted values | [Form](u03-after-desktop.png) | [Pending](u03-sending-mobile.png), [mobile order](u04-after-mobile.png). Failure recovery has a behavior check. |
| Services selector | [Desktop](u05-after-1440.png) | [Phone](u05-after-390.png) |
| Authentication email and recovery result | [Email gallery](email-review.md#authentication-contact-and-edge-cases) | [Actual generic recovery result](actual/auth-recovery-generic-result.png). The local backend rendered the reset message and recorded provider-not-configured. |
| Every mail detail family and optional/long states | [All 23 desktop variants](email-review.md) | [All 23 phone variants](email-review.md). Browser rendering only. |
| Recipient selection, retries, controls, access, deduplication and races | No image can establish these guarantees. | Exact-audience, schema-backed, delivery and controlled-mutation tests supply the evidence. See [rules R01 to R15](README.md#recipient-rules). |
| Type-only, lifecycle, readiness and shared style changes | They have no standalone page. | The [source coverage map](screenshot-coverage.json) maps every changed `src` implementation file to the corresponding pictures or behavioral proof. |

The [59-route audit](site-coverage.json) remains broader than this screenshot and signed-in acceptance set. Unchanged routes need no new picture. Shared presentation does not establish that every route or every business action passed in a browser. The native Notes error observed once with a writing extension remains unisolated; isolated normal keyboard entry passed. No production configuration, provider acceptance or mailbox delivery is claimed.
