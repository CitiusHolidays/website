# Booking confirmation emails and GST invoices

The [Billing & Payment Policy](../src/app/(public)/policies/page.client.js) promises that a
customer whose website payment succeeds receives a payment receipt, a booking confirmation email,
and a GST tax invoice within 48 hours, and that refunds go back to the original payment method.
This page describes how the public booking flow keeps those promises. It covers public website
Bookings only; CRM Job Card invoices (`convex/crm/invoiceCommands.ts`) are a separate,
staff-entered receivables record and are unchanged.

## Flow

```text
create-order ─► pending Booking ─► Razorpay checkout
                                     │
     /api/verify-payment (checkout) ─┤─► bookings.confirmBookingByOrderId
  webhook payment.captured (backup) ─┘        │ first accepted confirmation only
                                              ├─► seats debited, payment event recorded
                                              └─► schedules bookingPaymentFollowUps
                                                    ├─► GST invoice issued (or recorded as not configured)
                                                    └─► confirmation email queued
  webhook refund.created ─► bookings.markRefundedByPaymentId
                                              │ accepted confirmed → refunded only
                                              └─► schedules the follow-up ─► refund email queued
```

The payment mutation only schedules the follow-up, and the schedule commits with the payment
transition. The invoice and email then run in their own mutation, so invoice-series contention,
missing configuration, or an outbox problem can never fail or roll back a real payment. Convex runs a
scheduled mutation exactly once; if it fails, the payment stays confirmed and the failure shows in
the Convex logs.

## Exactly once

- A booking is confirmed by whichever arrives first: the checkout verification or the
  `payment.captured` webhook. Every later path, and every replay of either, takes the
  already-confirmed branch and issues no invoice and queues no email.
- Each email kind has one event identity per booking: `booking_confirmation/<bookingId>`,
  `booking_invoice_ready/<bookingId>`, and `booking_refund/<bookingId>`. The notification outbox
  holds one job per event and recipient, so even a repeated enqueue reuses the same job.
- The Resend request carries the idempotency key
  `crm-notification/<event>/<recipient-hash>`; dispatcher retries and recoveries reuse it.
- A refund email is queued only on the accepted `confirmed → refunded` transition. A repeated or
  second (partial) `refund.created` event is ignored by the transition and queues nothing.

`convex/bookingCustomerEmails.convex.integration.ts` exercises these guarantees through the real
mutations, outbox, dispatcher and a captured provider.

## Email delivery

Customer booking emails use the existing CRM notification outbox, delivery ledger, Resend
provider and pacing ([Notification email delivery](NOTIFICATION_EMAIL_DELIVERY.md)) with a
dedicated `customer_booking` recipient purpose:

- The recipient is the purchaser's Account profile email at confirmation time. A customer address
  is never resolved to a staff identity, even when it matches one.
- The message is rendered from the booking, trip and invoice at the first delivery attempt and then
  frozen for retries. Sender: `Citius Holidays <noreply@citiusholidays.com>`; reply-to:
  `info@citiusholidays.com`.
- Templates live in `convex/lib/bookingEmailContent.ts` and use the shared
  `renderTransactionalEmail` layout. They are transactional only: no offers, promotions or
  newsletter content.

| Email | Content |
| --- | --- |
| Booking confirmation | Booking ID, trip, travel dates, travellers, amount paid, payment reference, invoice number or "Being prepared", what happens next, support contact, link to `/account`. This doubles as the system-generated payment receipt. |
| Tax invoice ready | Sent only when an invoice is issued after confirmation (see *Not configured*): invoice number, booking, trip, amount, link to `/account`. |
| Refund started | Booking ID, trip, refund amount and Razorpay refund reference when supplied, payment reference, the 7–14 working-day timeline, support contact. |

### Live Feature Control

`email.customer_booking` (**Customer booking emails**, category Payments) gates delivery at the
outbox claim, the final effect boundary. While it is paused, a claimed delivery is recorded as
`skipped` with `delivery_control_disabled` and is not resent later. Invoices are still issued and
stay downloadable in the Account. When the email provider key is missing, delivery is skipped with
`provider_not_configured`, as for every other outbox email.

## GST tax invoice

One invoice per confirmed booking payment, stored in `bookingInvoices`:

- **Number:** `<PREFIX>/<FY>/<serial>`, for example `WEB/2627/00001` — at most 16 characters,
  consecutive and unique per series prefix and Indian financial year (1 April–31 March, IST). The
  `bookingInvoiceSeries` counter is read and incremented in the same serializable transaction that
  issues the invoice, so concurrent confirmations cannot share or skip a number. The serial is
  separate from the free-text numbers Accounts types on CRM Job Card invoices.
- **Amounts:** the amount the customer paid is treated as GST-inclusive. For an inter-state supply,
  taxable value = round(total ÷ (1 + rate)) to the paisa and the remainder is IGST. For an
  intra-state supply, CGST and SGST are each round(that taxable value × rate ÷ 2), so they are
  always equal, and the taxable value absorbs any rounding paisa so the parts sum to the amount
  paid.
- **Place of supply:** the booking flow records no billing address, so the supplier's state
  (derived from the GSTIN) is used and the invoice records that basis. The policy function already
  accepts a recipient state for when one is captured.
- **Immutable document:** the issued row stores a complete snapshot — supplier legal name, GSTIN,
  address and state; recipient name and email; SAC; quantity; rate; taxable value and tax split;
  place of supply; reverse-charge "No"; booking and payment references; and the date the payment
  was received, which can be earlier than the invoice date. A later configuration change never
  rewrites an issued invoice.

### Not configured and manual review

Company details are read from the Convex environment, never from code. If any value is missing or
invalid, the confirmation still succeeds and the invoice is recorded as `pending_configuration`
with the missing key *names*. The customer's confirmation email says the invoice will follow.
Other cases go to `manual_review` for Accounts: a foreign-currency booking (a GST invoice needs an
INR basis), a non-integer amount, or a booking that was refunded before its invoice could be
issued. For these the customer is never promised an emailed invoice: the confirmation email asks
them to contact the accounts team, and the Account shows the payment without an invoice line.

### Customer access

- The Journeys detail shows a **Payment and invoice** card for paid bookings: amount paid,
  payment state, and the invoice number with **Download tax invoice (PDF)**, or "Being prepared"
  while it waits for configuration.
- `GET /api/account/journeys/<bookingId>/invoice` renders the PDF on demand from the stored
  snapshot (`src/lib/bookingInvoice/bookingInvoicePdf.ts`). It requires a signed-in Account and
  returns the document only to the booking's purchaser; signed-out callers get 401 and everyone
  else gets 404 without learning whether the booking exists. Responses are `private, no-store`.

**Why a link rather than an attachment:** an attached PDF copies the customer's name, email and
payment data out of the access-controlled Account into every mailbox it is forwarded to; the
outbox freezes a small HTML/text message and has no attachment storage; and a link lets an invoice
issued after confirmation reach the customer without re-sending mail. The PDF is generated from
the same immutable snapshot every time.

## Configuration

Set these in the **Convex deployment environment** (Preview and Production separately). The
director is supplying the values; none is committed.

| Key | Value | Validation |
| --- | --- | --- |
| `CITIUS_INVOICE_LEGAL_NAME` | Registered legal name of the supplier | Required |
| `CITIUS_INVOICE_GSTIN` | 15-character GSTIN | Format check; first two digits must be a known GST state code, which also sets the supplier state |
| `CITIUS_INVOICE_ADDRESS` | Registered address as printed on the GST certificate, lines separated by `\|` | Required |
| `CITIUS_INVOICE_SAC` | SAC for the service, e.g. the tour-operator code the CA confirms | Six digits starting `99` |
| `CITIUS_INVOICE_GST_RATE_PERCENT` | GST rate the CA confirms for this SAC and ITC position, e.g. `5` | Number greater than 0 and at most 40, two decimals at most |
| `CITIUS_INVOICE_SERIES_PREFIX` | Prefix reserved for website-booking invoices | 1–4 capital letters or digits |

`RESEND_API_KEY` must already be set for any email to send.

## Deploy notes

1. Deploy the code. The schema change only adds tables and optional booking fields.
2. The new control has no stored state on a target whose control plane is active, so it resolves
   **Paused** (fail closed): no customer email sends until an Admin acts. On a target that has not
   activated the control plane, it follows its catalog default (Available).
3. Set the six `CITIUS_INVOICE_*` values in that Convex deployment. Until then, every confirmed
   booking records a `pending_configuration` invoice.
4. Issue invoices that were waiting for configuration, repeating until `scanned` is 0:

   ```bash
   bunx convex run --prod bookingInvoices:issuePendingBookingInvoices '{"limit": 50}'
   ```

   (Omit `--prod` for Preview.) Each issued invoice queues one "Tax invoice ready" email. Only an
   operator with fresh authority for the exact target runs this.
5. On Preview, confirm one test booking end to end: invoice number, PDF download from the
   purchaser's Account, 404 for another Account, and one delivered email with the control
   Available.
6. In Staff Workspace → Settings → Live Feature Controls, set **Customer booking emails** to
   Available (or run `migrateOperationalControlCatalog` to initialise it to Normal Behavior).
   Pausing it later stops sends without affecting payments or invoices.

## Known limits

- No credit note is generated for a refund; Accounts must raise one for a refunded invoiced booking.
- Recipient billing address, state and GSTIN are not collected, so B2B input-tax-credit invoices
  and recipient-state place of supply are not yet possible.
- The PDF uses the standard Helvetica font: names in non-Latin scripts print as `?`.
- Pending invoices are issued only when an operator runs `issuePendingBookingInvoices`; there is no
  scheduled job yet.
- Bookings confirmed before this release have no invoice record and are not backfilled; the
  Account shows their payment without an invoice line.
- The invoice carries no signature block; "This is a computer-generated invoice" is printed
  instead.
