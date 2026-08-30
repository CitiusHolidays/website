# Booking payment transition policy

## Decision

A payment failure is recoverable when the trusted provider later confirms the same booking order through a new, unique provider-event identity. Failure is not a client-authorized state transition, and a refunded booking is terminal. A confirmed booking cannot be downgraded by a late failure. Authorization, capture, inventory reservation, and refund progress remain separate state axes.

This policy reflects asynchronous provider delivery: a failure notification may arrive before a valid captured-payment callback. Recovery reuses the pending booking order but requires an authenticated server callback and an auditable provider event.

## Server contract

- Checkout starts with a short-lived, server-owned intent bound to canonical account identity, trip, traveler count, amount, currency, and receipt. The browser cannot replace those facts when a pending Booking is created.
- Pending Booking creation and all payment transitions require the payment mutation secret. The intent, authenticated customer, and exact Razorpay order attestation are consumed transactionally.
- Every supported signed webhook uses Razorpay's `x-razorpay-event-id` as its stable delivery identity. `bookingPaymentEvents` stores only bounded provider facts, the transition, before/after state, outcome, reason, and timestamp; raw bodies and signatures are not stored.
- Replaying the same event is idempotent. Reusing its identity for different payment facts is rejected. Valid unmatched events are retained for reconciliation rather than acknowledged and discarded.
- `pending -> failed -> confirmed` is allowed after a valid capture and debits inventory once.
- `confirmed -> failed` is ignored, `confirmed -> confirmed` is idempotent, and `refunded -> confirmed` is rejected without inventory change.
- A capture that cannot reserve inventory remains recorded as captured, marks the reservation unavailable, and enters reconciliation. It cannot retry later into a reservation or resurrect a cancelled/refunded Booking.
- Refund receipts are keyed by Razorpay refund ID. `created`/pending does not terminalize a Booking; only cumulative processed refund amounts do. Partial refunds preserve the captured remainder, and failed/excess/mismatched refunds enter reconciliation.
- Finance staff with `view:finance` can read the bounded reconciliation inbox and Booking event timeline. Those projections are read-only and expose no customer identity, raw payload, or signature.
- Customer-facing responses use opaque operational messages and never include callback secrets or signature details.

The executable contract lives in `convex/bookings.ts`; checkout binding lives in `convex/checkoutIntent.test.ts`; callback ordering, refund, duplicate, and inventory cases live in `convex/bookingsPaymentTransitions.test.ts`.
