# ADR 0018: Link minors to a guardian Traveller on the same Job Card

- Status: Accepted (owner decision relayed 2026-11-06; open questions below)
- Scope: Citius Connect CRM Travellers and passenger-family spreadsheets; contract only for the
  future Customer Travel Account

## Context

The owner decided that a minor is linked to a parent's account: a minor has no login of their own,
the parent sees the minor's trip, minors get no photo gallery, and parental consent applies (India
DPDP Act; Citius Holidays is the data fiduciary). The owner believed the CRM already made this link
while importing traveller spreadsheets.

It did not. Before this change the import read no parent, guardian, minor or age column. Date of
birth was parsed only into the encrypted passport payload, `guestCompanions` ("Guests travelling
with") was free text that the import always blanked, and `guestType` is Employee/Client/VIP. No
Traveller was linked to another Traveller, and no Traveller is linked to a Customer Account: Journey
Entitlements ([ADR 0013](0013-explicit-customer-journey-entitlements.md)) bind an Account Holder to a
confirmed Query, not to a Traveller row.

## Decision

- **Minor** is a Traveller under 18 on the trip's start date: the Travel in Series start, else the
  Job Card start, else the day the fact was recorded. `travellers.isMinor` is optional; unset means
  the age is not recorded, never "adult".
- The import decides minor status from an explicit Minor column, then an Age column, then the sheet's
  date of birth. The date of birth itself stays only in the encrypted passport payload; the
  Traveller row stores the derived flag, not the birth date.
- **Guardian** is an adult Traveller on the same Job Card. `travellers.guardianTravellerId` is an
  optional link from the minor to that Traveller. A minor has at most one guardian; a guardian can
  cover several minors. A traveller cannot be their own guardian, a known minor cannot be a
  guardian, and a traveller who stops being a minor keeps no guardian.
- The import reads Parent/Guardian name and contact columns (aliases include "Parent",
  "Guardian", "Parent/Guardian name" and "Travelling with"). The name is held on the minor as
  `guardianImportReference` until the final batch commits, then resolved once against the whole Job
  Card roster: normalised name (either name order), narrowed by phone (last 10 digits) or email
  when given. It links only when exactly one eligible adult matches. Unknown age, no match, several
  matches, a contact that disagrees, or a minor named as guardian leave the reference in place and
  appear as warnings in the import reconciliation report and on the traveller row.
- A row known to be an adult ignores the guardian column, because "Travelling with" on an adult's
  row names companions.
- A sheet without guardian or age columns leaves existing values alone. A guardian whose age is not
  recorded is accepted (it is not a known minor); recording them as a minor later is refused while
  they cover a minor.
- Operations set or clear the age group and the guardian in the traveller editor through the
  existing `travellers.update`/`create` mutations, so the permission is exactly "may edit this
  traveller". Guardian choices come from `travellers.listGuardianOptions`, which needs the same
  manage permission and Job Card access. Deleting a guardian unlinks their minors.
- **Privacy:** the Staff Workspace row names a linked guardian or minor only when the reader may
  already see that Traveller under the same Tour Manager group scope. The traveller master export,
  which is office-only for the whole Job Card, adds Minor and Parent/Guardian columns that the
  import reads back.

## Customer Travel Account contract (not built)

There is no seam today that ties an Account Holder to a Traveller, so this change builds no customer
read and no customer authorization. When customer invites and the customer app are built:

- A minor never receives an Account, invite or Journey Entitlement of their own.
- A guardian's traveller entitlement must name the guardian's own Traveller row. The guardian's
  confirmed-trip projection may then include the minors whose `guardianTravellerId` is that
  Traveller, as read-only journey facts with name only.
- The projection exposes no Sensitive Travel Documents for minors and no photo gallery (event,
  post-tour or traveller-feedback photos) of a minor.
- Recording parental consent for a minor is a separate, auditable fact; linking a guardian is not
  consent.
- Entitlements remain explicit ([ADR 0013](0013-explicit-customer-journey-entitlements.md)): a
  guardian link, a matching email or a Client contact never grants access by itself.

## Consequences

- Schema change is additive and optional (`isMinor`, `guardianTravellerId`,
  `guardianImportReference`, index `by_guardianTravellerId`). No backfill: no existing data
  identifies guardians, and minor status derived from passport birth dates would need decrypting
  every passport; the next import of a sheet with a date of birth or age column records it.
- Linking is bounded to a roster of 2,000 Travellers per Job Card; larger Job Cards report one
  warning and are linked manually.

## Open questions for the owner

- Should a guardian whose age is not recorded be refused until they are marked Adult?
- Should a minor be allowed more than one guardian (for example both parents)?
- Is 18 on the trip start date the right line for every destination, or do some trips need the
  destination's age of majority?
