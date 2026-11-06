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
4. External tour managers should be wired in. See [External tour managers](#external-tour-managers).

## Traveller scope

`jobCardRecordGrant` in `convex/crm/lib/recordScope.ts` says how the caller reaches a Job Card:
`"office"` (department, owner, collaborator or linked query), `"tourManager"` (only an assignment
or the legacy `tourManagerName` match) or `null`. `canSeeJobCardRecord` is unchanged in meaning.

For a `"tourManager"` grant, `convex/crm/tourManagerGroupScope.ts` derives the group from the
caller's own `Assigned` rows in `tourManagerAssignments`:

- any own assignment without a batch: the whole Job Card;
- otherwise the assigned batches;
- no own assignment: the legacy batch-level, then Job Card-level `tourManagerName` match;
- nothing matched: an empty group, never the whole roster.

External-profile assignments never match. `crm/travellers:listPage` and `getListRow` apply the
scope; unbatched travellers are visible only with Job Card-wide scope. Passenger-family exports
need an office grant, because they carry the whole roster and
decrypted passport details. Visa, ticketing and rooming records keep ordinary Job Card scope; they
carry no traveller contact numbers.

## Functions

All functions require an active staff session. Ids are Convex ids as strings.

| Function | Kind | Args | Returns | Server check |
| --- | --- | --- | --- | --- |
| `crm/jobCards:listMyAssignedPage` | query | `{ paginationOpts, status? }` | `PaginationResult<JobCardListRow>`, same row shape as `listPage` | `view:jobCards`; walks the caller's own `Assigned` assignments, one row per Job Card, then `canSeeJobCardRecord` |
| `crm/travellers:listPage` | query | unchanged | unchanged | rows narrowed to the caller's group for a Tour Manager-only grant |
| `crm/fieldSync:pushHeadcountStop` | mutation | `{ clientStopId, clientUpdatedAt?, day: "YYYY-MM-DD", jobCardId, label, presentTravellerIds: string[], startedAt: ms, travelBatchId? }` | `{ applied, id, ignoredTravellerIds }` | `view:travellers`, Job Card visible, batch inside the caller's group |
| `crm/fieldSync:recordAnnouncement` | mutation | `{ body, clientAnnouncementId, clientUpdatedAt?, jobCardId, recipientTravellerIds, seenByTravellerIds, sharedAt: ms, travelBatchId? }` | `{ applied, id, ignoredTravellerIds }` | as above |
| `crm/fieldPassports:listFieldPassports` | query | `{ jobCardId, referenceNow: ms }` | `{ timeZone, travellers: [{ travellerId, hasPassportScan, opensAt, closesAt, available }] }` | Tour Manager role, own assignment on the Job Card, own group only |
| `crm/fieldPassportActions:getFieldPassportFile` | action | `{ travellerId }` | `{ bytes, fileName, mimeType }` | Tour Manager role, portal file rate limit, own group, trip window; writes an audit row |
| `crm/finance:createExpense` | mutation | existing args plus optional `clientRef` | `{ id }` | unchanged, plus idempotent replay |

Office readers (Operations, Operations Cement, Operations Head, Directors, Admin, Director Cement,
with office scope on the Job Card):

| Function | Kind | Args | Returns |
| --- | --- | --- | --- |
| `crm/fieldSync:listLatestHeadcounts` | query | `{ jobCardId, dayLimit? }` (default 7, max 31) | `null` for other callers, else `[{ day, stopCount, latest: [{ id, label, startedAt, recordedByName, travelBatchId, batchLabel, presentCount, expectedCount, missing: [{ id, fullName }], updatedAt }] }]` |
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
- **Expenses.** `clientRef` is optional. The same author and `clientRef` return the first expense;
  the same `clientRef` on another Job Card is rejected. Callers without `clientRef` keep today's
  behavior.

## Field passports

The CRM passport path (`crm/passport:getPassportMetadata`, `crm/passportActions:*`, document
preview) now needs an office grant on the Job Card **and** `view:visa` from a role other than Tour
Manager (`canReadPassportInStaffWorkspace` in `convex/crm/passportPolicy.ts`). Office roles are
unchanged. The Passport documents view shows a Tour Manager-only user "Opens in the tour manager
app during the trip" instead of the decrypt button.

The field path keeps the existing storage and encryption: the scan stays encrypted at rest and is
decrypted in the Node action for that one caller; no storage id or URL reaches the device. The
internal mutation `crm/fieldPassports:authorizeFieldPassportRead` checks the Tour Manager role,
the own-assignment grant, group scope and the window, then inserts the
`fieldPassportAccessAudit` row (actor staff id, name and auth id, traveller, Job Card, batch,
time) in the same transaction before the file is read.

**Trip window and time zone.** Citius stores no trip time zone, so the window uses the office
time zone, India Standard Time (UTC+05:30, no daylight saving, as in leave lapse and office
check-in). It opens at 00:00 IST on the day before travel starts and closes at 24:00 IST on the
day after travel ends. The traveller's Travel Batch dates apply where recorded, else the Job
Card's; a missing end date means a one-day trip; without a start date the window stays closed.
The extra day on each side covers trips in other time zones.

Audit rows hold identifiers and times only and are kept when the Job Card is deleted. Retention
follows the passport retention schedule; none is configured yet (see ADR 0012).

## External tour managers

Today an external tour manager is an `externalTourManagerProfiles` contact (name, email, phone,
experience) maintained by Operations Head and directors/admins. Assignments can link a profile
(`externalProfileId`) but carry no `staffId`, so they grant no Job Card scope, and there are no
external logins, invitations or messages ([Team travel](TEAM_TRAVEL.md)). `/auth/vendor` is an
unrelated "coming soon" vendor portal.

The only route to app access today: Admin or Directors (`manage:staff`) create a staff record with
only the Tour Manager role and complete onboarding; Operations then assigns that staff identity.
Every path above works for that person, because scope is keyed on staff id plus the Tour Manager
role. The profile directory refuses a profile whose email or phone already belongs to staff, so
the two identities do not mix.

Letting an Operations user grant app access directly from a profile needs product decisions that
this change does not make; see the PR description for the proposal.

## Deploy notes

- Schema changes are additive: three tables (`fieldHeadcountStops`, `fieldAnnouncements`,
  `fieldPassportAccessAudit`), optional `expenseEntries.clientRef`, and indexes
  `expenseEntries.by_createdBy_and_clientRef` and
  `tourManagerAssignments.by_staffId_and_status_and_jobCardId`. No backfill.
- Job Card deletion removes field headcounts and announcements.
- The [assigned Tour Manager backfill](migrations/job-card-assigned-tour-manager-staff-ids.md)
  should be verified on each deployment; until then older assignments rely on the name fallback.
