# The notification inbox

The [signed-in local checks](local-acceptance.md) now show the actual app, existing test accounts and isolated local backend. All 28 selected workflow checks passed. The earlier state examples below remain component checks with substituted sign-in, server responses and navigation. No email was sent.

![The actual signed-in Contracting inbox](local/inbox-unread-desktop.png)

| All on a phone | The actual bell |
| --- | --- |
| ![One read assignment and one unread assignment](local/inbox-all-phone.png) | ![Opening the bell leaves both updates unread](local/inbox-bell-desktop.png) |

The signed-in run checked all 12 staff profiles, the Query deep link, a head taking their own work, and the independent workload count and orange dot. [Read the exact results and limits](local-acceptance.md).

## Earlier component-state examples

These pictures use the current components with fictional responses. They cover loading and failed reads that the signed-in run did not force.

## Unread and All

Unread shows the updates still needing to be opened. All also shows read history. Switching to All left both unread updates unread and made no read request.

![The desktop inbox with two unread updates](inbox/inbox-unread-desktop.png)

![All includes read history without clearing either unread update](inbox/inbox-all-desktop.png)

## The same inbox on a phone and in the bell

The Notifications page and bell use the same inbox. Opening the bell preserved the unread count. The phone pictures use a 390 by 844 viewport.

| Notifications page | Bell |
| --- | --- |
| ![Two unread updates on a phone](inbox/inbox-unread-phone.png) | ![The bell shows the same two unread updates](inbox/inbox-bell-phone.png) |

Opening the Contracting assignment marked only that update read. The other update stayed unread, and the component requested `/portal/queries?open=query&id=demo-query`. A later synthetic arrival increased the unread count again without another read request. The local navigation substitute recorded the requested link; this does not prove the destination loaded or authorized the record on a deployed backend.

![All after opening one update, with the other still unread](inbox/inbox-all-after-one-phone.png)

## Empty, loading and failed requests

No history and no unread work are different states. The latter offers access to read updates. Loading shows placeholders instead of a false empty message.

| No history | Read history remains | Loading |
| --- | --- | --- |
| ![No notifications yet](inbox/inbox-empty-phone.png) | ![All caught up with a link to read updates](inbox/inbox-read-history-phone.png) | ![Loading placeholders](inbox/inbox-loading-phone.png) |

The error example supplies the existing page error banner and rejects a synthetic read request. Activating the update left both items unread. It checks the inbox's failed-read behavior and error layout, not a deployed transport's error reporting.

![Failed read request preserves the unread updates](inbox/inbox-error-phone.png)

## Staff and authorized email-status views

The Ticketing example shows assigned ticket attention and reminder content. Ordinary Contracting and Ticketing views have no email-delivery panel. An Admin example shows email status separately from the personal inbox. Its accepted/retrying values are sample responses, not provider receipts. Accepted means the service took the email; it does not confirm delivery to a mailbox.

![Ticketing's personal inbox without an email-delivery panel](inbox/inbox-ticketing-desktop.png)

![Admin's personal inbox beside the separate email-status panel](inbox/inbox-admin-desktop.png)

These role pictures check presentation. They do not prove recipient separation by putting different lists into the review. The registered backend tests separately cover exact audiences, unrelated staff, overlapping roles, reassignment, inactive staff, record access and head fallback. The [recipient rules](README.md#recipient-rules) retain their R01 to R15 review anchors.

## Signed-in local acceptance

Local acceptance is complete for the [listed scenarios](local-acceptance.md#workflows-that-passed). A fresh loopback backend used the designated synthetic accounts and the repository's seed, revision and cleanup checks. No hosted Preview, access change or hosted backend update was needed. Both runtime identities matched before seeding. Cleanup left zero active runs, zero owned rows and zero outbox entries. This work did not change the original local database.

The earlier Preview-access investigation is historical. It is not a prerequisite for these local checks. Local success does not establish production configuration or provider delivery.

## Pictures and evidence coverage

| Claimed change | Actual picture or comparison | Evidence and remaining limit |
| --- | --- | --- |
| Shared inbox, Unread/All, selected read, bell, late arrival, failed read | The desktop and phone pictures above | Signed-in local inbox, bell, selected read and destination checks are in local-acceptance.md. Earlier loading/error examples retain synthetic transport. |
| Assignment, leave, Tour Manager and ticket emails | [Email examples](README.md#the-emails) | Production HTML with fictional values from the earlier notification review. No provider or mailbox acceptance. |
| Heads can take their own work | [Self-assignment picture](README.md#r03-direct-job-card-assignment) | Actual selector plus a signed-in Head of Ticketing self-assignment and persisted-value check. Other head/work combinations retain registered tests. |
| Recipient, retry and deduplication rules | [R01 to R15](README.md#recipient-rules) | Schema-backed and controlled-mutation evidence. A screenshot cannot prove audience or delivery guarantees. |
| Staff filters, Account editing, Contact and Services | [U01 to U05 before/after](site-usability.md) | Actual components and focused behavior tests. Their distinct visual designs remain. |
| Sidebar, search, count/dot, table, forms and detail layout | [U06 to U09 pictures](crm-redesign.md#u06-a-quieter-workspace) | Populated desktop and phone components. Per-person count/dot tests are separate from inbox read state. |
| Proposal actions, operational context, pending-save recovery and travel | [Staff journey pictures](crm-redesign.md#staff-journey-coverage) | Current forms, lists and custom screens with regression tests. The selected signed-in local workflows passed; the 59-route source review is broader than that acceptance. |

[Machine-readable evidence](inbox-browser-evidence.json) records the exact source revision, substitutes, observations, crop bounds and image hashes. Browser chrome and private account identifiers were excluded from the published crops. The earlier gallery is review evidence. U12 separately removes an unrelated empty-record footer; its ordinary tests and restored mutation are in local-acceptance.json.
