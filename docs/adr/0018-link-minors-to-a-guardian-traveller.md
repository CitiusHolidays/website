# ADR 0018: Link minors to up to two guardian Travellers on the same Job Card

- Status: Accepted (owner decisions relayed 2026-11-06, including answers to the questions below)
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
- **Guardian** is an adult Traveller on the same Job Card. A minor has up to **two** guardians (for
  example both parents); a guardian can cover several minors. A traveller cannot be their own
  guardian, cannot name the same guardian twice, a known minor cannot be a guardian, and a
  traveller who stops being a minor keeps no guardians.
- **Storage:** the minor holds its guardians in two optional, indexed slots,
  `travellers.firstGuardianTravellerId` and `travellers.secondGuardianTravellerId`; every API and
  screen presents them as one ordered list. Convex cannot index array membership, so a
  `guardianTravellerIds` array would leave "which minors does this guardian cover" without an
  index. A separate link table was the other option: it would need its own consistency with the
  Traveller row and a new stage in the paged Job Card deletion cleanup, otherwise deleting a Job
  Card would leave link rows behind. Two slots match the owner's cap exactly, keep the reverse
  lookup to two index reads, and disappear with the Traveller row. Removing a guardian compacts
  the slots so the first fills first.
- The import reads Parent/Guardian name and contact columns (aliases include "Parent",
  "Guardian", "Parent/Guardian name", "Parent 1" and "Travelling with") and a second pair
  ("Parent 2", "Guardian 2", "Parent/Guardian 2", "Second Parent", each with an optional
  phone or email column). One cell may also name two people joined by "&", "and" or "/"; their
  contacts pair up by position only when there is one contact per name. The names are held on
  the minor as `guardianImportReferences` until the final batch commits, then resolved once
  against the whole Job Card roster. Each name is matched on its own: normalised name (either
  name order), narrowed by phone (last 10 digits) or email when given, linking only when exactly
  one eligible adult matches. When at least one name matches, the matches become the minor's
  guardians and the rest stay pending; unknown age, no match, several matches, a contact that
  disagrees, a minor named as guardian, the same adult named twice, or a third name are reported
  as warnings in the import reconciliation report and on the traveller row.
- A row known to be an adult ignores the guardian column, because "Travelling with" on an adult's
  row names companions.
- A sheet without guardian or age columns leaves existing values alone. A guardian whose age is not
  recorded is accepted (it is not a known minor); recording them as a minor later is refused while
  they cover a minor. The owner confirmed this on 2026-11-06.
- Operations set, change or clear the age group and up to two guardians in the traveller editor
  through the existing `travellers.update`/`create` mutations (`guardianTravellerIds`, an empty
  list clears), so the permission is exactly "may edit this traveller". Guardian choices come from
  `travellers.listGuardianOptions`, which needs the same manage permission and Job Card access.
  Deleting a guardian removes only that link; the minor keeps their other guardian.
- **Privacy:** the Staff Workspace row names each linked guardian or minor only when the reader
  may already see that Traveller under the same Tour Manager group scope; one guardian can be
  shown while the other is withheld. The traveller master export, which is office-only for the
  whole Job Card, adds Minor, Parent/Guardian and Parent/Guardian 2 columns that the import reads
  back.

## Customer Travel Account contract (not built)

There is no seam today that ties an Account Holder to a Traveller, so this change builds no customer
read and no customer authorization. When customer invites and the customer app are built:

- A minor never receives an Account, invite or Journey Entitlement of their own.
- A guardian's traveller entitlement must name the guardian's own Traveller row. The guardian's
  confirmed-trip projection may then include the minors that name that Traveller in either
  guardian slot, as read-only journey facts with name only. Both guardians see the same minor.
- The projection exposes no Sensitive Travel Documents for minors and no photo gallery (event,
  post-tour or traveller-feedback photos) of a minor.
- Recording parental consent for a minor is a separate, auditable fact; linking a guardian is not
  consent.
- Entitlements remain explicit ([ADR 0013](0013-explicit-customer-journey-entitlements.md)): a
  guardian link, a matching email or a Client contact never grants access by itself.

## Consequences

- Schema change is additive and optional (`isMinor`, `firstGuardianTravellerId`,
  `secondGuardianTravellerId`, `guardianImportReferences`, indexes `by_firstGuardianTravellerId`
  and `by_secondGuardianTravellerId`). No backfill: no existing data
  identifies guardians, and minor status derived from passport birth dates would need decrypting
  every passport; the next import of a sheet with a date of birth or age column records it.
- Linking is bounded to a roster of 2,000 Travellers per Job Card; larger Job Cards report one
  warning and are linked manually.

## Owner answers (2026-11-06)

- A guardian whose age is not recorded stays accepted until someone marks them as a minor.
- A minor may have up to two guardians.
- "Under 18 on the trip start date" applies to every destination.
