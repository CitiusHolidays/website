# Citius bounded-context map

This map routes product language to its owning glossary. It names product
relationships only; source modules and deployment topology belong in the
[backend reference](docs/BACKEND_INFRASTRUCTURE.md).

| Bounded context | Language owner | Actors and invariant |
| --- | --- | --- |
| Citius Connect CRM | [Citius CRM context](CONTEXT.md) | Staff operate Queries, Proposals, Confirmed Offers, Job Cards, and delivery records. Staff identity and permissions remain internal. |
| Customer Travel Account | [Customer Travel Account context](docs/customer-account/CONTEXT.md) | Account Holders see only journeys granted by explicit entitlements. Account identity grants no Staff Workspace authority. |
| Sacred Bharat | [Sacred Bharat context](docs/sacred-bharat/CONTEXT.md) | Anonymous Edition Participants recognise Sacred Details and share Result Artifacts. Social Edition events are separate from CRM leads and staff state. |

## Relationships

- Public-site intent may hand off into the CRM as a consented, source-attributed
  enquiry. A Sacred Bharat Journey Link opens pilgrimage exploration; any later
  CRM handoff requires its own explicit consent. The CRM owns the resulting Query.
- A CRM Confirmed Offer may project journey facts read-only into the Customer
  Travel Account. The immutable commercial record remains owned by the CRM.
- Shared sign-in infrastructure or a matching email does not merge authority.
  **Staff identity** and **Customer Account identity** keep separate permissions,
  records, and user-facing language. Anonymous Edition participation grants neither.
  Retired Yatri tracker vocabulary describes historical data only.

Do not create a bounded context for a technical module alone. Add a context
only when it has distinct actors, language, and invariants that cannot safely be
owned by an existing glossary.
