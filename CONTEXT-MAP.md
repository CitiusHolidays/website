# Citius bounded-context map

This map routes product language to its owning glossary. It names product
relationships only; source modules and deployment topology belong in the
[backend reference](docs/BACKEND_INFRASTRUCTURE.md).

| Bounded context | Language owner | Actors and invariant |
| --- | --- | --- |
| Citius Connect CRM | [Citius CRM context](CONTEXT.md) | Staff operate Queries, Proposals, Confirmed Offers, Job Cards, and delivery records. Staff identity and permissions remain internal. |
| Customer Travel Account | [Customer Travel Account context](docs/customer-account/CONTEXT.md) | Account Holders see only journeys granted by explicit entitlements. Account identity grants no Staff Workspace authority. |
| Sacred Bharat | [Sacred Bharat context](docs/sacred-bharat/CONTEXT.md) | Guests and signed-in Yatris record Darshans, Soul Score, trails, and planning intent. Yatri identity and progress are not CRM staff state. |

## Relationships

- Public-site or Sacred Bharat intent may hand off into the CRM as a consented,
  source-attributed enquiry. The public experience supplies intent; the CRM
  owns the resulting operational Query.
- A CRM Confirmed Offer may project journey facts read-only into the Customer
  Travel Account. The immutable commercial record remains owned by the CRM.
- Shared sign-in infrastructure or a matching email does not merge authority.
  **Staff identity**, **Customer Account identity**, and **Yatri identity** keep
  separate permissions, records, and user-facing language.

Do not create a bounded context for a technical module alone. Add a context
only when it has distinct actors, language, and invariants that cannot safely be
owned by an existing glossary.
