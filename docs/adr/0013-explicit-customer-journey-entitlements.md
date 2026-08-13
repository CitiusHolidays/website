# ADR 0013: Explicit Customer Journey Entitlements

- Status: Accepted
- Accepted: 2026-08-12
- Scope: Customer Travel Account journey reads

## Decision

Every Customer Travel Account journey read is authorized by a server-owned Journey Entitlement or
the temporary, explicitly linked legacy Booking-owner compatibility path. An entitlement binds one
canonical issuer-qualified auth identity to one Booking or CRM confirmed journey, records the
holder role (`purchaser`, `organizer`, or `traveller`), and carries only `view_booking` or
`view_confirmed_trip`.

Public Booking creation writes the Booking and purchaser entitlement transactionally. CRM confirmed
journeys require an explicit Staff grant against a visible confirmed Query and immutable Confirmed
Offer. Email, Client contact, Traveller name, and browser-supplied identity never establish access.

## Projection boundary

- Booking projections omit payment-provider identifiers, signatures, internal notes, Traveller
  details, and storage ownership.
- Confirmed-journey projections contain immutable offer and frozen itinerary facts only. They do not
  expose mutable Proposal state, Staff Workspace access, or Sensitive Travel Documents.
- Each packet returns a narrow entitlement role and source so authorization provenance is visible
  without revealing issuer/provider identifiers.
- Revocation removes access without deleting the underlying CRM or Booking record.

## Migration and ambiguity

Legacy Booking owners remain readable only when
[ADR 0009](0009-auth-token-identity-migration.md)'s authoritative identity link maps the current
issuer-qualified identity to that exact legacy subject. The bounded migration creates purchaser
entitlements while converting Booking owners. Conflicts are quarantined, never guessed or merged by
email.

Shared email, changed email, duplicate Client, sibling Traveller, and corporate organizer cases are
governed by the [Customer Travel Account glossary](../customer-account/CONTEXT.md). Target migration
and authenticated two-account evidence remain separate release steps.

## Consequences

Account access no longer depends on broad email fan-out and can represent purchasers, organizers,
and Travellers without conflating them. CRM operators must deliberately grant confirmed-trip access;
automatic Client- or Traveller-wide entitlement remains a non-goal.
