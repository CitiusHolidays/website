# Customer Travel Account context

The Customer Travel Account is the authenticated, customer-facing projection of journeys and
account facts. It is not the Staff Workspace, a Client database view, or a Traveller document
portal.

## Language

**Customer Account Holder**:
The authenticated person represented by the server's canonical issuer-qualified identity. An
Account Holder can have one or more explicit Journey Entitlements. A matching contact email is
reconciliation evidence only and never grants access.
_Avoid_: Client contact, Traveller, staff user, browser-supplied user ID, email as ownership

**Client**:
The person or organization purchasing or receiving Citius service in the CRM. A Client may have
several contacts and Travellers, but a Client record alone grants no Account access.
_Avoid_: Account Holder, authenticated principal, automatic organizer entitlement

**Traveller**:
One person travelling under a journey or Job Card. Being a Traveller does not automatically expose
the organizer's commercial facts, sibling Travellers, or Sensitive Travel Documents.
_Avoid_: Client contact, Account Holder, all passengers sharing one authority

**Booking**:
The payment and reservation record created by the public booking flow. Its authenticated purchaser
receives a purchaser Journey Entitlement; payment identifiers and internal notes are not Account
journey fields.
_Avoid_: Confirmed Offer, Query, email-owned reservation

**Customer Journey**:
A read-only Account projection backed by either a public Booking or an immutable CRM Confirmed
Offer. It exposes only the facts allowed by its Journey Entitlement.
_Avoid_: editable Proposal, Staff Workspace record, Sensitive Travel Document collection

**Journey Entitlement**:
An explicit server-owned relationship between one canonical Account Holder identity and one
Booking or confirmed CRM journey. It records the holder's role (`purchaser`, `organizer`, or
`traveller`), narrow read capabilities, source, grant provenance, and revocation state.
_Avoid_: normalized-email match, Client-wide access, Job Card membership, browser ID

## Allow and deny outcomes

| Scenario | Outcome |
| --- | --- |
| Public purchaser completes a Booking | Allow that Booking through a purchaser entitlement created in the same mutation. |
| CRM operator grants an organizer or Traveller a confirmed journey | Allow only that immutable confirmed-journey packet through the explicit grant. |
| Shared corporate or family email matches a Client | Deny; contact equality is not an entitlement. |
| Account Holder changes email | Preserve access because the canonical identity and entitlement, not email, own it. |
| Duplicate Client rows share contact details | Do not merge authority or fan out journeys. |
| One sibling Traveller has an entitlement | Do not expose sibling Traveller journeys or documents. |
| Same subject appears under a different issuer | Deny legacy ownership unless one authoritative identity link maps that exact issuer-qualified identity. |
| Canonical and legacy ownership conflict | Deny and create a privacy-safe quarantine item for operator resolution. |

## Invariants

- The server derives Account Holder identity from the authenticated token. Browser IDs, route IDs,
  emails, phone numbers, Client IDs, and Traveller names are never authority.
- Account journey packets explain their entitlement role and source.
- CRM Confirmed Offer facts remain immutable and read-only in Account.
- Account access grants no Staff Workspace permission and no Sacred Bharat group/progress authority.
- Customer Document Intake remains a separate one-Traveller capability governed by
  [ADR 0012](../adr/0012-customer-document-intake-security-contract.md); a Journey Entitlement does
  not grant document upload or download.
