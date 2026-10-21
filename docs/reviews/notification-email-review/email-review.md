# Citius transactional emails

These are browser renders of the real React Email templates with fictional values. No message was sent. They show layout and content at desktop and phone widths, not Gmail, Outlook or mailbox delivery.

The emails share Citius branding, compact labeled details, one primary action and a visible fallback link. CRM private notes, document details, leave reasons and cost price stay behind portal access checks. Subjects, recipients, approval stages, existing links, retries and duplicate prevention retain their meaning. Authentication keeps its current token and callback construction. Plain text includes the secure action link and separates every detail label from its value. A regression test reproduced concatenated rows before the fix and passed afterward; all 46 HTML pictures remain byte-identical.

## Workflow mail

| Email | Desktop | Phone |
| --- | --- | --- |
| Contracting assignment | ![Contracting assignment at desktop width](emails/query-desktop.png) | ![Contracting assignment on a phone](emails/query-phone.png) |
| New website enquiry | ![New website enquiry at desktop width](emails/inboundQueryIntent-desktop.png) | ![New website enquiry on a phone](emails/inboundQueryIntent-phone.png) |
| Proposal ready for review | ![Proposal ready for review at desktop width](emails/proposal-desktop.png) | ![Proposal ready for review on a phone](emails/proposal-phone.png) |
| Job Card opened on your query | ![Job Card opened on your query at desktop width](emails/jobCard-desktop.png) | ![Job Card opened on your query on a phone](emails/jobCard-phone.png) |
| Traveller details updated | ![Traveller details updated at desktop width](emails/traveller-desktop.png) | ![Traveller details updated on a phone](emails/traveller-phone.png) |
| Ticketing action needed | ![Ticketing action needed at desktop width](emails/ticket-desktop.png) | ![Ticketing action needed on a phone](emails/ticket-phone.png) |
| PNR details updated | ![PNR details updated at desktop width](emails/pnr-desktop.png) | ![PNR details updated on a phone](emails/pnr-phone.png) |
| Passport status updated | ![Passport status updated at desktop width](emails/passport-desktop.png) | ![Passport status updated on a phone](emails/passport-phone.png) |
| Visa status updated | ![Visa status updated at desktop width](emails/visa-desktop.png) | ![Visa status updated on a phone](emails/visa-phone.png) |
| Flight group updated | ![Flight group updated at desktop width](emails/flight-desktop.png) | ![Flight group updated on a phone](emails/flight-phone.png) |
| Seat allocation updated | ![Seat allocation updated at desktop width](emails/seat-desktop.png) | ![Seat allocation updated on a phone](emails/seat-phone.png) |
| Invoice overdue | ![Invoice overdue at desktop width](emails/invoice-desktop.png) | ![Invoice overdue on a phone](emails/invoice-phone.png) |
| Expense awaiting approval | ![Expense awaiting approval at desktop width](emails/expense-desktop.png) | ![Expense awaiting approval on a phone](emails/expense-phone.png) |
| Approval request updated | ![Approval request updated at desktop width](emails/approval-desktop.png) | ![Approval request updated on a phone](emails/approval-phone.png) |
| Leave awaiting your approval | ![Leave awaiting your approval at desktop width](emails/leave-desktop.png) | ![Leave awaiting your approval on a phone](emails/leave-phone.png) |
| Hotel arrangements updated | ![Hotel arrangements updated at desktop width](emails/hotel-desktop.png) | ![Hotel arrangements updated on a phone](emails/hotel-phone.png) |
| Tour Manager allocated | ![Tour Manager allocated at desktop width](emails/tourManager-desktop.png) | ![Tour Manager allocated on a phone](emails/tourManager-phone.png) |

## Authentication, contact and edge cases

| Email | Desktop | Phone |
| --- | --- | --- |
| Verify your Citius Holidays account | ![Verify your Citius Holidays account at desktop width](emails/verification-desktop.png) | ![Verify your Citius Holidays account on a phone](emails/verification-phone.png) |
| Reset your Citius Holidays password | ![Reset your Citius Holidays password at desktop width](emails/password_reset-desktop.png) | ![Reset your Citius Holidays password on a phone](emails/password_reset-phone.png) |
| Website contact enquiry | ![Website contact enquiry at desktop width](emails/contact-desktop.png) | ![Website contact enquiry on a phone](emails/contact-phone.png) |
| Contact enquiry without optional phone | ![Contact enquiry without optional phone at desktop width](emails/contact-minimal-desktop.png) | ![Contact enquiry without optional phone on a phone](emails/contact-minimal-phone.png) |
| Update without optional details | ![Update without optional details at desktop width](emails/minimal-desktop.png) | ![Update without optional details on a phone](emails/minimal-phone.png) |
| Long content and link | ![Long content and link at desktop width](emails/long-desktop.png) | ![Long content and link on a phone](emails/long-phone.png) |

Staff password setup uses the existing password-reset template. It does not add a separate approval or account flow. Other workflow events and reminders use the matching details above with their own existing subject and context. An update with no matching detail record uses the minimal template.

## What stayed the same

CRM messages still freeze their prepared content before the existing delivery attempt. A queued message whose content was already frozen retains that content on retry. Newly prepared messages use this layout. Recipient checks, operational controls, replay keys, provider pacing, cancellation and privacy filters remain in their existing delivery code. Contact replies keep the submitted Reply-To address.

No provider settings, hosted email editor, tracking pixel, remote image or external font was added. The installed React Email packages support React 19 and their Convex edge renderer. No dependency upgrade was needed.

The 46 captured views made zero network requests and had no page-level horizontal overflow at 900-pixel desktop or 390-pixel phone width. Escaping, unsafe URL rejection, omitted optional details, exact authentication links and deterministic preparation have separate tests. These checks do not certify every mail client or production delivery.
