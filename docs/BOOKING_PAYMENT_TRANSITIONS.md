# Booking payment transition policy

## Decision

A payment failure is recoverable when the trusted provider later confirms the same booking order through a new, unique provider-event identity. Failure is not a client-authorized state transition, and a refunded booking is terminal. A confirmed booking cannot be downgraded by a late failure.

This policy reflects asynchronous provider delivery: a failure notification may arrive before a valid captured-payment callback. Recovery reuses the pending booking order but requires an authenticated server callback and an auditable provider event.

## Server contract

- Anonymous callers cannot invoke payment transitions; the server-to-server Convex mutations require the payment mutation secret.
- Every callback has a stable `providerEventId`, stored in `bookingPaymentEvents` with the transition, before/after status, outcome, reason, and timestamp.
- Replaying the same event is idempotent. Reusing its identity for another transition is rejected.
- `pending -> failed -> confirmed` is allowed after a valid capture and debits inventory once.
- `confirmed -> failed` is ignored, `confirmed -> confirmed` is idempotent, and `refunded -> confirmed` is rejected without inventory change.
- Confirmation fails without mutating the booking when inventory is no longer available.
- Confirmation carries the paid amount and currency from the provider: the signed `payment.captured` webhook entity, or for checkout verification the payment the server fetches from Razorpay (never values from the browser; the fetched payment must belong to the signed order and be `authorized` or `captured`). A paid amount or currency that differs from the booking's `totalAmount`/`currency` (under- or overpayment) does not confirm: no seats, invoice or email. The booking keeps its status, `paymentMismatch` records expected vs paid, and each attempt is logged in `bookingPaymentEvents` with outcome `amount_mismatch` for staff to reconcile or refund. Replays keep reporting the mismatch.
- Customer-facing responses use opaque operational messages and never include callback secrets or signature details.

- The first accepted confirmation also schedules a follow-up mutation that issues the booking's GST tax invoice (or records it as not configured) and queues the customer confirmation email; a failure there never affects the payment transition. The accepted `confirmed -> refunded` transition stores the Razorpay refund reference and amount and schedules one refund email. Duplicate and later events add neither; see [Booking emails and invoices](BOOKING_EMAILS_AND_INVOICES.md).

The executable contract lives in `convex/bookings.ts`; the callback ordering and inventory cases live in `convex/bookingsPaymentTransitions.test.ts`, and the email and invoice side effects in `convex/bookingCustomerEmails.convex.integration.ts`.
