# Notification and email review

This change gives staff one place to read their updates and makes CRM email recovery durable. Staff open the bell or Notifications, choose Unread or All, then open the relevant work. They do not choose a retry strategy or resend an uncertain email.

All people, trips and records in the screenshots are fictional. The review uses the actual Citius shell, header, inbox, controls and email HTML, with mocked navigation and Convex transport. It does not prove a deployed session, a real mailbox delivery or a live customer workflow.

## What changes for staff

Opening the bell does not mark anything read. Switching Unread and All does not mark anything read. Activating one update marks only that update read and opens its existing portal destination. A later update appears without marking other updates read. Notifications remain available to ordinary staff without access to the administrative activity log or email diagnostics. A date filter carried from another workspace no longer hides older unread updates.

The inbox removes the red Delete action from each row. Its primary action is to open the work. Staff see no manual retry or resend button. Heads and other already authorized roles can inspect email counts. Admin and Directors retain their separate activity permission and existing audit filters.

![Staff inbox on mobile](staff-mobile.png)

![The bell on mobile](bell-mobile.png)

![Leader view with email status](leader-desktop.png)

The previous activity component is shown below in the same fictional review fixture. For this Operations Head it hid the personal inbox while showing email diagnostics. The old list also put a red Delete action beside every update when an administrator could see it.

![Previous notification components](before-desktop.png)

## Who receives each event

This table describes the code paths reviewed for this change. It does not redefine every existing role subscription. A role-targeted email still honors the existing additive email-alert roles and department-head expansion. Before each CRM send, the worker rechecks the staff member's active status, address and the existing record visibility rules for supported entities.

| Event | Bell and email audience | Exclusions or retained boundary |
| --- | --- | --- |
| Website enquiry | Existing Sales and Sales Head audience, plus the retained info mailbox email copy. | No new customer acknowledgement or marketing email. The Sales-email and mailbox-copy switches remain separate, under the existing master CRM-email control. |
| Contracting or Ticketing assignment | The selected SPOC. Contracting and Operations heads also receive the assignment handoff. Initial unassigned Ticketing work reaches Head of Ticketing when Ticketing is required. | No general Contracting-team email. "Not required" does not alert Ticketing. |
| Proposal submitted to Sales | The assigned Sales SPOC. Both auth IDs and older staff IDs resolve to that staff record. | The former whole-Sales fallback is removed. An unresolved or ambiguous owner falls back to Sales Head oversight. |
| Date or destination revision | The assigned Contracting SPOC, required Ticketing SPOC, and the relevant heads. | Existing revision workflow and queue stay intact. No new Ticketing work for "Not required". |
| Order lost | Assigned Contracting SPOC and Contracting Head, plus the assigned Ticketing SPOC when Ticketing is required. | Other Contracting staff are excluded from this notice. |
| Order confirmed | Existing Accounts handoff to open the Job Card, existing Finance notice, Contracting and Operations heads, and assigned Contracting and required Ticketing SPOCs. Head of Ticketing receives required Ticketing oversight. | Unassigned base Contracting, Operations and Ticketing teams no longer receive the operational confirmation broadcast. |
| Job Card opened | Assigned Contracting and required Ticketing SPOCs, Contracting and Operations heads, required Head of Ticketing, assigned Sales SPOC and Sales Head, and the staff member identified by the Finance Head function. | Other base-team staff are excluded. This does not turn all Finance staff or all Directors into the Finance Head. |
| Operations, Contracting or Ticketing owner changed | Existing direct assignment to the chosen staff member. | No new audience. Current staff access is checked again before email dispatch. |
| Tour Manager allocated | The existing selected staff Tour Manager audience, with Job Card, trip, dates, destination, pax and reporting context. | No new Operations CC or external Tour Manager invitation policy. |
| Ticket attention | Existing Operations and Operations Head workflow audience. | Email must also pass current Job Card visibility. This change does not rewrite that existing role subscription. |
| Expense submission and decisions | Existing assigned manager, submitting staff member and Finance approval flow. The existing Finance/Directors approval audience remains. | The reporting hierarchy is not used as an automatic CC list for unrelated events. |
| Leave request and decisions | Existing configured head approver, distinct final authority when required, configured HR recipient and requesting staff member, according to the stage. | No new self-approval authority. The July sheet's HR-copy wording and the app's HR final-review step need the decision below. |
| Scheduled workflow reminders | Existing enabled rules, configured recipient roles and repeat limits. All CRM sends use the durable delivery worker. | No new reminder rules, broader subscriptions or shorter repeat interval. Other maintenance jobs do not become email campaigns. |
| Verification, password reset and staff setup | Existing transactional message to the account holder or setup recipient, with separate purpose controls and token expiry. | These remain separate from the CRM queue. The shared provider request now receives cancellation. No token, role or authentication-policy change. |
| Customer booking, payment and feedback | Existing product behavior. Account authentication email remains transactional. Post-tour feedback sharing and thank-you drafts remain manual. | No booking receipt, charge notification, automatic feedback invitation or promotional email is introduced. The retired contact endpoint still returns 410. |

The Management CC mentioned in the newer Activity Flow workbook remains unresolved. There is no new Management group and no automatic expansion to every Admin or Director.

## What the email says

The email gives the event, useful record context and one link to Citius Connect. Private leave reasons, decision notes, passport fragments, files, internal notes, cost prices and budget amounts stay in the portal. The explicitly approved inbound enquiry message remains available for the inbound follow-up purpose.

The samples below use the production HTML renderer and fictional values. The exact event wording comes from its workflow publisher; these examples illustrate the content layout and intended recipient purpose.

| Example | Intended recipient | People excluded |
| --- | --- | --- |
| Contracting assignment for Q-0264 | The assigned Contracting SPOC. | Other Contracting SPOCs and unrelated Sales staff. Heads receive their own oversight notice. |
| Leave request | The configured approver and configured HR recipient for the relevant stage. | The employee's general department, unrelated managers and a guessed Management list. |
| Tour Manager allocation for JC-0264 | The selected staff Tour Manager. | Other Tour Managers and an automatic Operations CC. |

![Assignment email on mobile](email-query-mobile.png)

![Leave email on mobile](email-leave-mobile.png)

![Tour Manager email on mobile](email-tourManager-mobile.png)

## What happens when email fails

The business transaction stores each recipient's email job and queued ledger entry together. A worker claims one attempt, fixes the rendered message for that event and recipient, then calls the email provider. Recovered attempts reuse that content and the same provider key. A second worker cannot claim an active lease.

Provider requests time out after ten seconds. CRM workers share the existing minimum 550 ms provider pacing. Temporary failures retry in the background, up to four attempts. A provider response counts as accepted only when it contains a receipt ID. Job completion and the privacy-safe ledger update commit together.

The provider keeps idempotency keys for 24 hours. Recovery stops before that window expires. If the outcome is uncertain, the app records that uncertainty and stops. It does not send a new message with a new key. An accepted job remains deduplicated in the app after those 24 hours.

The diagnostic count now says "accepted" rather than "sent". Acceptance means the email service took the message. It does not confirm mail-server delivery, inbox placement or a human read. This change does not add a delivery webhook or request new credentials.

If an employee becomes inactive, changes email address or loses access to the record before a retry, the worker stops that email. A changed operational control is also checked before dispatch. The public summary contains counts and authorized record links, not recipient addresses or provider response bodies. Private recipient addresses and frozen HTML are removed from terminal queue jobs.

![Empty inbox on mobile](empty-mobile.png)

![Loading bell on mobile](loading-bell-mobile.png)

## Decisions for director review

1. Name the exact members of Management and the events that should copy them. The Activity Flow 1.0 sheet names Management but does not define membership. Existing verified audiences remain in place.
2. Confirm the leave approval policy. The July leave workbook often makes Final Authority equal Level 1 and names HR as a copy recipient. The later app has a distinct HR final-review step. This change preserves the current approval authority and does not import self-approval rules from the sheet.
3. Review the retained role-targeted Ticketing-attention and configurable reminder audiences if those should become assignment-only too. They remain explicit existing subscriptions. The changed intake, commercial handoff and Job Card events use assigned SPOCs and named head roles.

## Sources and limits

The local source review used Activity Flow - citius.xlsx, Activity Flow - citius 1.0.xlsx, reporting team citius connect.xlsx and Leave_Approval_Flow 2026_1.0.xlsx. Relevant examples include Contracting Team B12/B13/C20 and Accounts C14 in the Activity Flow sheets, and Level 1, Final Authority and HR-copy columns in the July leave matrix. The reporting hierarchy was supplied for leave and expenses, not a universal CC policy.

The June and July correspondence distinguished a bell alert from an email, required the selected Contracting SPOC plus heads, required assigned Tour Manager trip context and reported Ticketing/revision gaps. Current code and existing later workflow decisions were checked before treating those old reports as current defects.

Source workbooks and mailbox extracts are not committed. These screenshots contain no real staff addresses, phone numbers, customer records, tokens or leave reasons. The test browser uses no provider credentials and sends no email.

The independent regression reproduced a proposal handoff to an unrelated Sales colleague before the fix. The new queue tests also exercise replay, worker exclusion, fixed content, late loss of access, active/address changes, control changes, provider receipt validation and atomic rollback. Controlled source mutations separately remove lease protection, fixed-content reuse and the access recheck. Each must fail its targeted behavior test; an ordinary passing test is not described as mutation evidence.

Target-neutral checks do not prove a deployment. Before any rollout, the approved non-production target still needs code generation, schema deployment and authenticated workflow checks under the repository's release process. Production deployment and merging this draft are outside this change.
