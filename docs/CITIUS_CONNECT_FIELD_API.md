# Tour manager app: field API

The tour managers' mobile app (Expo, in the separate `citius-app` repository) signs in with the
staff Better Auth identity and calls the Convex functions below. The Staff Workspace keeps its own
behavior; the field rules here only narrow what a Tour Manager-only grant reaches.

Owner decisions of 6 Nov 2026 behind this API:

1. A tour manager sees traveller rows (including phone numbers) only for the Travel Batches they
   are assigned to. An assignment to a Job Card with no batch shows the whole Job Card. Office
   roles keep their access.
2. A tour manager does not get passports in the Staff Workspace, but can in the field, for their
   own group, during the trip window. Every field read is audited.
3. Headcounts and announcements sync to the office. The server never sends a message.
4. External tour managers should be wired in. See [External tour managers](#external-tour-managers)
   for the owner decisions of 7 Nov 2026 that do this.

## Traveller scope

`jobCardRecordGrant` in `convex/crm/lib/recordScope.ts` says how the caller reaches a Job Card:
`"office"` (department, owner, collaborator or linked query), `"tourManager"` (only an assignment
or a legacy name match) or `null`.

**Name matches.** Names compare after Unicode NFKC normalization, whitespace collapsing and case
folding, and a staff user's portal name is their staff record name (never the sign-in identity's
self-asserted name). The legacy Tour Manager name route needs the Tour Manager role and applies
only while the Job Card has no assigned staff Tour Manager, so a namesake never rides on someone
else's assignment. `syncJobCardTourManagerVisibility` now also derives
`jobCards.legacyTourManagerNames` (active name-only assignments: no staff id, no external
profile) and writes both derived fields on every assignment change; once written, that list is
the only name source, so an external profile's name (which `createTourManager` copies into
`tourManagerName`) grants nothing. Job Cards untouched since this change keep the
`tourManagerName` fallback until the [legacy-names backfill](migrations/job-card-tour-manager-legacy-names.md)
runs.

For a `"tourManager"` grant, `convex/crm/tourManagerGroupScope.ts` derives the group:

- own active staff assignments: any without a batch opens the whole Job Card, otherwise the
  assigned batches;
- only when no assignment on the Job Card has a staff id: matching active name-only rows;
- only when the Job Card has no assignment rows at all: the batch-level, then Job Card-level,
  `tourManagerName`;
- nothing matched: an empty group, never the whole roster.

The group applies to `crm/travellers:listPage` and `getListRow`, `crm/visa:list` and
`listTravellersWithoutVisa`, `crm/ticketing:listTickets`, `getTicketListRow`,
`listSeatAllocations`, the ticketing dashboard preview, and the traveller rows of
`crm/jobCards:getCommandCenter`. A row without a traveller needs whole-Job Card scope. PNRs and
flight groups carry no traveller names and keep Job Card scope. For a caller without Staff
Workspace passport access the traveller rows blank `hasPassportScan` and `passportExpiryDate`
(the `passportStatus` word stays, as the app shows it), and the `passportExpiryUrgency` filter is
refused.

**Exports.** Spreadsheet imports and exports ignore permissions that come only from the Tour
Manager role (`convex/crm/passengerKindPolicy.ts`), and passenger-family exports also need an
office grant: they carry the whole roster, contact numbers and decrypted passport details. A Tour
Manager added as a Job Card collaborator therefore still cannot export.

## Functions

All functions require an active staff session. Ids are Convex ids as strings.

| Function | Kind | Args | Returns | Server check |
| --- | --- | --- | --- | --- |
| `crm/jobCards:listMyAssignedPage` | query | `{ paginationOpts, status? }` | `PaginationResult<JobCardListRow>`, same row shape as `listPage` | `view:jobCards`; walks the caller's own `Assigned` assignments, one row per Job Card, then `canSeeJobCardRecord` |
| `crm/travellers:listPage` | query | unchanged | unchanged | rows narrowed to the caller's group for a Tour Manager-only grant |
| `crm/fieldSync:pushHeadcountStop` | mutation | `{ clientStopId, clientUpdatedAt?, day: "YYYY-MM-DD", jobCardId, label, presentTravellerIds: string[], startedAt: ms, travelBatchId? }` | `{ applied, id, ignoredTravellerIds }` | `view:travellers`, Job Card visible, batch inside the caller's group |
| `crm/fieldSync:recordAnnouncement` | mutation | `{ body, clientAnnouncementId, clientUpdatedAt?, jobCardId, recipientTravellerIds, seenByTravellerIds, sharedAt: ms, travelBatchId? }` | `{ applied, id, ignoredTravellerIds }` | as above |
| `crm/fieldPassports:listFieldPassports` | query | `{ jobCardId, referenceNow: ms }` | `{ timeZone, travellers: [{ travellerId, hasPassportScan, mimeType, opensAt, closesAt, available }] }`; `mimeType` is the scan's file type (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`) from the same metadata the file read uses, or `null` without a scan | Tour Manager role, own staff assignment on the Job Card, own group only |
| `crm/fieldPassportActions:getFieldPassportFile` | action | `{ travellerId }` | `{ bytes, fileName, mimeType }` | Tour Manager role, portal file rate limit, own staff assignment (no name match), own group, trip window; writes an audit row |
| `crm/finance:createExpense` | mutation | existing args plus optional `clientRef` | `{ id }` | unchanged, plus idempotent replay |

Office readers (Operations, Operations Cement, Operations Head, Directors, Admin, Director Cement,
with office scope on the Job Card):

| Function | Kind | Args | Returns |
| --- | --- | --- | --- |
| `crm/fieldSync:listLatestHeadcounts` | query | `{ jobCardId, dayLimit? }` (default 7, max 14) | `null` for other callers, else `[{ day, stopCount, latest: [{ id, label, startedAt, recordedByName, travelBatchId, batchLabel, presentCount, expectedCount, missing: [{ id, fullName }], missingCount, updatedAt }] }]`; reads at most the newest 40 stops and names at most 25 missing travellers per stop |
| `crm/fieldSync:listAnnouncements` | query | `{ jobCardId, paginationOpts }` | `PaginationResult<{ id, body, sharedAt, authorName, travelBatchId, batchLabel, recipientCount, seenCount, updatedAt }>`; `FORBIDDEN` for other callers |
| `crm/fieldPassports:listFieldPassportAccess` | query | `{ jobCardId, paginationOpts }` | audit rows `{ id, accessedAt, actorName, travellerId, travellerName }`; needs Staff Workspace passport access |

The Job Card page shows a read-only **Field updates** panel (`JobCardFieldUpdates`) to office
readers: the latest stop per tour manager per day, X of Y present, who is missing, the time, and
the announcement list with seen-by counts.

## Sync semantics

- **Idempotency.** A headcount stop is keyed by recorder staff id, Job Card and `clientStopId`; an
  announcement by author staff id, Job Card and `clientAnnouncementId`. Client ids are 1 to 128
  letters, digits, `.`, `:`, `-` or `_`. A repeated push updates the same row.
- **Ordering.** Send `clientUpdatedAt` (the device clock of the state being pushed). A push older
  than the stored one returns `applied: false` and changes nothing.
- **Scope.** Without `travelBatchId`, a push covers the writer's whole group. Traveller ids outside
  the group, unknown or deleted are dropped and counted in `ignoredTravellerIds`.
- **Expected travellers.** The server stores the travelling travellers (not cancelled, not a
  last-minute drop) of the group or batch at push time, so "X of Y" stays stable if the roster
  changes later.
- **Days.** `day` is the tour manager's local day and cannot change for an existing stop.
- **Announcements.** Text and batch are fixed once recorded; later pushes update `seenBy`, which
  is limited to the recorded recipients.
- **Limits.** 2000 travellers per Job Card for field sync; labels are trimmed to 120 characters,
  announcement text is 1 to 4000 characters.
- **Expenses.** `clientRef` is optional and needs a signed-in staff account (no shared fallback
  author). The same author and `clientRef` return the first expense;
  the same `clientRef` on another Job Card is rejected. Callers without `clientRef` keep today's
  behavior.

## Field passports

The CRM passport path (`crm/passport:getPassportMetadata`, `crm/passportActions:*`, document
preview) now needs an office grant on the Job Card **and** `view:visa` from a role other than Tour
Manager (`canReadPassportInStaffWorkspace` in `convex/crm/passportPolicy.ts`). Office roles are
unchanged. The Passport documents view shows a Tour Manager-only user "Opens in the tour manager
app during the trip" instead of the decrypt button.

`listFieldPassports` returns each scan's `mimeType` so the app can offer in-app viewing only for
types it can render and never spends an audited read on a file it cannot show.

The server cannot tell the app from a web session: `getFieldPassportFile` works for any session
of a Tour Manager with an own staff assignment, inside the window, for their own group, and every
call is audited.

The field path keeps the existing storage and encryption: the scan stays encrypted at rest and is
decrypted in the Node action for that one caller; no storage id or URL reaches the device. The
internal mutation `crm/fieldPassports:authorizeFieldPassportRead` checks the Tour Manager role,
the own-assignment grant, group scope and the window, then inserts the
`fieldPassportAccessAudit` row (actor staff id, name and auth id, traveller, Job Card, batch,
time) in the same transaction before the file is read.

**Trip window and time zone.** Citius stores no trip time zone, so the window uses the office
time zone, India Standard Time (UTC+05:30, no daylight saving, as in leave lapse and office
check-in). It opens at 00:00 IST on the day before travel starts and closes at 24:00 IST on the
day after travel ends. When the traveller's Travel Batch records a start date, the batch's own
start and end apply; otherwise the Job Card's pair. The two are never mixed. A missing end date
means a one-day trip; without a start date the window stays closed.
The extra day on each side covers trips in other time zones.

Passport notification emails (status, expiry, last four, file name) follow the same Staff
Workspace passport rule, so a Tour Manager-only recipient never receives them.

Audit rows hold identifiers and times only and are kept when the Job Card is deleted. Retention
follows the passport retention schedule; none is configured yet (see ADR 0012).

## External tour managers

An external tour manager is an `externalTourManagerProfiles` contact (name, email, phone,
experience) maintained by the Operations Head and directors/admins. `/auth/vendor` is an unrelated
"coming soon" vendor portal.

Owner decisions of 7 Nov 2026:

1. The Operations Head (and directors/admins) give an external tour manager a login from their
   profile. HR is not involved.
2. The login reaches both this app and the CRM, but only what concerns the trips they are assigned
   to: those Job Cards, their own group's travellers (same group scope as staff tour managers), the
   field features (headcount, announcements, field passports inside the trip window) and their own
   trip expenses. No dashboard, team or staff directory, queries, proposals or other Job Cards.
3. No HR flows: no leave, approvals, onboarding paperwork, employment fields, reporting managers,
   payroll, staff travel, team directory or HR emails.
4. Access ends only when someone switches it off; switching off refuses CRM and app access at
   once. Nothing expires on its own.

**The login.** `crm/externalTourManagerProfiles:setAppAccess { profileId, enabled }` (Operations
Head, Directors, Director Cement, Admin; `FORBIDDEN` for anyone else) creates or reactivates one
`staffUsers` row with `externalTourManagerProfileId` set and the Tour Manager role, and records it
on the profile (`externalTourManagerProfiles.staffId`). The profile needs an email, which becomes
the sign-in; an email that belongs to any other staff record is refused, so a profile can never
take over an employee's identity. A new login gets the ordinary staff verification and
password-setup emails (`crm/staffAction:provisionStaffUser`); enabling again while setup is still
pending sends them again. `enabled: false` sets the login inactive, so `getPortalAccess` resolves no
staff record and every query, mutation and action refuses the session at once. Existing Better Auth
sessions are not deleted; they simply reach nothing. Deactivating the profile for new assignments
does not change access. `get` and `list` return `appAccess: { status: "none" | "enabled" |
"disabled", onboarding: "not_started" | "pending" | "ready" }`.

**Narrowed access** (`convex/crm/lib/staffAccess.ts`). For such a login `getPortalAccess` returns
`externalTourManager: true`, the roles `["Tour Manager"]` whatever is stored, and exactly
`EXTERNAL_TOUR_MANAGER_PERMISSIONS`: `view:jobCards`, `view:travellers`, `view:expenses`,
`create:expenses`. The baseline leave and expense permissions every role gets are not added.
`requireStaff(ctx)` without a permission (the staff-wide reads: travel schedule, post-tour feedback
and tour reports, traveller feedback, office check-in, document preview) refuses the login;
`requireStaffSession` admits it only where the endpoint is already scoped to the caller
(notifications, navigation counts, saved views, list-search readiness, the field-updates panel).

**Scope.** `jobCardRecordGrant` gives such a login no office route at all (no owner, collaborator,
name or linked-query match) and no legacy name match: only its own staff-id assignment, as a
`"tourManager"` grant narrowed to its group. Queries and proposals are never visible to it.
`getCommandCenter` returns the Job Card, the itinerary summary and the group's traveller passport
words, with empty invoices, files, hotels, rooming, tickets, visas, checklist and no linked query.
Commercial files, query and proposal attachments and the Proposal Doc are refused, although a
staff Tour Manager reaches them through the Job Card. `crm/ops:listTourManagers` needs a `jobCardId` the login can see and
then lists the tour managers on that trip; without it the call is `FORBIDDEN` (the app always
passes one). Expenses: only the login's own, always on a visible Job Card; submitting for approval
goes to the Job Card's Operations owner (`operationsOwnerId`) for the manager step, then Finance.

**Assignments.** Assigning a profile that has a login stores both `externalProfileId` and the
login's `staffId`; granting a login puts the `staffId` on the profile's existing assignments and
recomputes `syncJobCardTourManagerVisibility` for each affected Job Card. `legacyTourManagerNames`
still ignores every row with a profile or staff id, so an external profile's name never grants a
same-named staff member scope. A login cannot be picked as a staff Tour Manager; it is assigned
through its profile.

**Staff administration.** The login never appears in the team directory, team pickers, Settings
staff list, staff travel people picker or event booth; `upsertStaff`, `removeStaff`, the staff
import and the staff workbook refuse or skip it, and it is never a reporting manager or leave
approver. The profile's email is locked once a login exists; name and phone edits are copied to
the login.

The tour manager app needs no change: it signs in as staff, requires the Tour Manager role and
calls only the functions listed above.

## Deploy notes

- Schema changes are additive: optional `jobCards.legacyTourManagerNames`, three tables (`fieldHeadcountStops`, `fieldAnnouncements`,
  `fieldPassportAccessAudit`), optional `expenseEntries.clientRef`, and indexes
  `expenseEntries.by_createdBy_and_clientRef` and
  `tourManagerAssignments.by_staffId_and_status_and_jobCardId`. No backfill.
- Job Card deletion removes field headcounts and announcements.
- External tour manager logins (7 Nov 2026) add two optional fields,
  `staffUsers.externalTourManagerProfileId` and `externalTourManagerProfiles.staffId`. No index, no
  backfill: no existing row is a login until someone grants access.
- Run the [Tour Manager legacy-names backfill](migrations/job-card-tour-manager-legacy-names.md)
  and the [assigned Tour Manager backfill](migrations/job-card-assigned-tour-manager-staff-ids.md)
  on each deployment. Until they run, untouched Job Cards still grant Job Card-level access by
  `tourManagerName`, which can hold an external profile's name.
- The traveller list's "Passport expiry" filter is hidden from users without Staff Workspace
  passport access, and the Passport documents view never sends the expiry-urgency filter for
  them.
