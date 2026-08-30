# ADR 0016: Server-owned Razorpay checkout and reconciliation

## Status

Accepted (2026-08-30)

## Context

Razorpay Checkout needs browser-visible order identifiers, but those identifiers cannot authorize a Booking, amount, customer, or inventory transition. Provider callbacks can be duplicated or delivered out of order, and capture, reservation, and refund progress do not share one safe lifecycle.

## Decision

1. Razorpay remains the only payment processor. This change adds no provider factory and does not alter account capture configuration.
2. Convex creates a short-lived checkout intent before the provider call. It binds the canonical authenticated customer to the trip, travelers, integer amount, currency, and receipt.
3. The Next.js order edge requires its server payment capability before contacting Razorpay. Pending Booking creation consumes the authenticated intent and exact returned order attestation in one Convex transaction. Client/provider identifiers alone grant no authority.
4. Raw webhook bytes are HMAC-verified before parsing. Supported deliveries require Razorpay's `x-razorpay-event-id`; bounded signed facts are stored transactionally even when no Booking matches.
5. Authorization, capture, reservation, and refund are distinct Booking projections. A captured payment reserves and decrements inventory at most once. If inventory is unavailable, or the Booking is cancelled/refunded, capture is retained for reconciliation and cannot later resurrect a reservation.
6. Refund IDs have monotonic ledger rows. Pending creation is non-terminal, processed partial refunds retain the remainder, and only exact cumulative processed value completes refund state. Failed, excess, or mismatched facts require review.
7. Staff with `view:finance` receive a bounded read-only reconciliation inbox and Booking event timeline. It exposes no raw provider body, signature, server secret, or customer identity and performs no automatic retry, refund, or inventory repair.

## Consequences

- A failed post-provider Booking write may leave an unconsumed Razorpay order, but cannot create a charge or Booking authority from browser data.
- Signed duplicate and unmatched events remain explainable and replay-safe.
- Capture without reservation is explicit operational work rather than a hidden rollback or later inventory resurrection.
- Legacy Bookings use conservative derived state until a separately authorized migration exists; this ADR does not authorize a backfill, deployment, provider call, or live money action.
