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
5. The app is piloted trip by trip (director, 7 Nov 2026): nothing about a Job Card shows in the
   app until someone starts its pilot. See [Per-trip app pilot](#per-trip-app-pilot).

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
Workspace passport access the traveller rows blank `hasPassportScan` (the `passportStatus` word
stays, as the app shows it). `passportExpiryDate` and the `passportExpiryUrgency` filter are wider:
visa or ticketing read authority from an office role on an office grant is enough, because
Ticketing books against expiry dates (owner decision, 7 Nov 2026). A Tour Manager-only grant gets
neither.

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

Audit rows hold identifiers and times only and are kept when the Job Card is deleted, but only
until the trip is over (owner decision, 7 Nov 2026): each row stores the trip window's close as
`retainUntil`, and the daily `jobs.purge_field_passport_audit` job
(`crm/fieldPassportAuditRetention`) deletes rows past it. It re-reads the trip dates first, so an
extended trip keeps its rows until the new close.

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
5. Their trip expenses go to the Job Card's Operations owner for the manager approval step, then
   to Finance (they have no reporting manager).
6. They see the visa rows and the ticket, PNR and seat rows of their own group on their assigned
   Job Cards, as staff tour managers do. They get no passport data in the CRM at all: no scans,
   scan flag, passport number, expiry date, passport files or exports. They read passports only
   through the field-passport flow in the app, inside the trip window, like staff tour managers.
7. They write and read the post-tour feedback (tour manager notes) and the internal tour report
   for their own assigned trips only, and read the traveller responses for those trips. Other
   trips' feedback and reports and the staff-wide areas stay closed.

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
`EXTERNAL_TOUR_MANAGER_PERMISSIONS`: `view:jobCards`, `view:travellers`, `view:visa`,
`view:ticketing`, `view:expenses`, `create:expenses`. The baseline leave and expense permissions
every role gets are not added. `requireStaff(ctx)` without a permission (the staff-wide reads:
travel schedule, office check-in) refuses the login; `requireStaffSession`
admits it only where the endpoint is already scoped to the caller (notifications, navigation
counts, saved views, list-search readiness, the field-updates panel) or narrows it itself
(post-tour feedback, tour reports and traveller responses, below).

**Scope.** `jobCardRecordGrant` gives such a login no office route at all (no owner, collaborator,
name or linked-query match) and no legacy name match: only its own staff-id assignment, as a
`"tourManager"` grant narrowed to its group. Queries and proposals are never visible to it.
`getCommandCenter` returns the Job Card, the itinerary summary, the group's traveller passport
status words and the group's visa and ticket statuses, with empty invoices, files, hotels,
rooming, checklist and no linked query.
Commercial files, query and proposal attachments and the Proposal Doc are refused, although a
staff Tour Manager reaches them through the Job Card. `crm/ops:listTourManagers` needs a `jobCardId` the login can see and
then lists the tour managers on that trip; without it the call is `FORBIDDEN` (the app always
passes one). Expenses: only the login's own, always on a visible Job Card; submitting for approval
goes to the Job Card's Operations owner (`operationsOwnerId`) for the manager step, then Finance
(owner decision 5).

**Visa, ticket, PNR and seat rows** (owner decision 6). `crm/visa:list`,
`listTravellersWithoutVisa`, `crm/ticketing:listTickets`, `getTicketListRow`,
`listSeatAllocations` and `listPnrs` and the flight itinerary work with the same group narrowing
as for staff tour managers (PNRs and flight groups keep Job Card scope). None of these rows carries
passport fields. Traveller rows keep the `passportStatus` word the app shows and blank
`hasPassportScan` and `passportExpiryDate`. `canReadPassportInStaffWorkspace` refuses an external
login outright, so passport metadata, scans, previews, the field-passport audit list and the
expiry filter stay `FORBIDDEN` even with `view:visa`; passenger, passport, visa and traveller
exports ignore Tour Manager permissions and need an office grant, so they stay refused.
`crm/ticketing:dashboard` refuses the login (its work coverage counts rows before visibility), and
the CRM hides the Passport documents and Ticket dashboard pages from it. Ticket shortcuts in
`crm/navShortcuts:list` follow the same group narrowing as the ticket list, for staff tour
managers too. The only document the login can preview is its own expense receipt
(`crm/documentPreview`, source `expenseAttachment`, through the existing expense scope); every
other preview source refuses it.

**Post-tour feedback and reports** (owner decision 7). `crm/postTourFeedback` (`create`,
`update`, `remove`, photos, `list`, `listJobs`, `getJobContext`) and `crm/postTourReports`
(`saveDraft`, `submit`, `workspace`) accept the login only on a Job Card where it holds an own
staff-id assignment; no name match applies. Lists drop every other trip, and the submitted-report
read that is staff-wide for employees returns `null` for it. `crm/travelerFeedback:listResponses`
and response photos return only its visible trips; issuing or revoking traveller feedback links
stays with office staff.

**Assignments.** Assigning a profile that has a login stores both `externalProfileId` and the
login's `staffId`; granting a login puts the `staffId` on the profile's existing assignments and
recomputes `syncJobCardTourManagerVisibility` for each affected Job Card. `legacyTourManagerNames`
still ignores every row with a profile or staff id, so an external profile's name never grants a
same-named staff member scope. A login cannot be picked as a staff Tour Manager; it is assigned
through its profile.

The derived Job Card fields keep employees and external logins apart:
`assignedTourManagerStaffIds` lists employee rows only (a `staffId` and no `externalProfileId`) and
still decides whether the legacy name route applies, so granting an external login never ends a
name-only employee's access; `externalTourManagerStaffIds` lists the external logins and is the
only list `ownsTourManagerJobCard` reads for them. See the
[external-logins backfill](migrations/job-card-external-tour-manager-logins.md).

**One series per external assignment.** On a Job Card that travels in series (has Travel
Batches), `createTourManager` and `updateTourManager` refuse an external-profile assignment without
`travelBatchId`, and the profile page's assignment form asks for the series. Group scope fails
closed for rows that already exist: an external login's assignment without a batch on such a Job
Card opens the Job Card but no travellers, visa or ticket rows and no field passports until
Operations sets the batch. On a Job Card without series a batchless assignment still covers the
whole Job Card.

**Sign-in safety.** Granting refuses an email listed in `PORTAL_BOOTSTRAP_ADMINS`. Staff
provisioning (for every staff record) no longer reuses an existing Better Auth account that
another staff record already holds, and `crm/staff:linkAuthUserId` refuses to attach such an
account to an external login. Server-side audience checks (notification email and work audiences,
navigation activity) rebuild access through `portalAccessForStaff`, the same narrowing as
`getPortalAccess`.

**Staff administration.** The login never appears in the team directory, team pickers, Settings
staff list, staff travel people picker or event booth; `upsertStaff`, `removeStaff`, the staff
import and the staff workbook refuse or skip it, and it is never a reporting manager or leave
approver. The profile's email is locked once a login exists; name and phone edits are copied to
the login.

External logins needed no app change: the app signs in as staff, requires the Tour Manager role
and calls only the functions listed above. The [app pilot](#per-trip-app-pilot) does need one.

## Per-trip app pilot

Owner decision (director, 7 Nov 2026): Citius pilots the apps trip by trip. Each Job Card has an
on/off switch. Nothing about a trip shows in the tour manager app until someone presses **Start
pilot** on it; from then on every app feature works for it. **Stop pilot** turns it off again. The
same switch will later gate the customer app, so it is stored generically as
`jobCards.appPilot = { enabled, changedAt, changedBy, changedByName }`. A missing field means
off.

**Who switches it.** The Operations Head, Directors, Director Cement, Admin and the Job Card's
own Operations owner (`jobCards.operationsOwnerId`), on a Job Card they can see
(`canManageAppPilot` in `convex/crm/appPilot.ts`). External tour manager logins never can.
Everyone else gets `FORBIDDEN`. Each change writes a Job Card activity row (`entityType`
`"jobCard"`, action `app_pilot_started` or `app_pilot_stopped`, with the actor and time);
repeating the current state changes and logs nothing.

| Function | Kind | Args | Returns |
| --- | --- | --- | --- |
| `crm/jobCards:getAppPilot` | query | `{ jobCardId }` | `null` when the caller cannot see the Job Card, else `{ enabled, changedAt, changedByName, canManage }` (`changedAt` and `changedByName` are `null` until the first change) |
| `crm/jobCards:setAppPilot` | mutation | `{ jobCardId, enabled }` | the same state object; `FORBIDDEN` for callers who may not switch it |

The Job Card page shows the state and a **Start pilot** / **Stop pilot** button
(`JobCardAppPilot`) above **Field updates**. Stopping asks for confirmation first and says the trip
disappears from tour managers' phones.

**What an off trip looks like to the app.** Authorization runs first, exactly as today; only a
caller who could otherwise use the trip meets the pilot check.

- `crm/jobCards:listMyAssignedPage` leaves the Job Card out. The page cursor still walks
  assignments, so a short or empty page with `isDone: false` is normal: keep paging.
- These app-only functions refuse it with `ConvexError` data `"APP_PILOT_OFF"` on every call:
  `crm/fieldSync:pushHeadcountStop`, `crm/fieldSync:recordAnnouncement`,
  `crm/fieldPassports:listFieldPassports`, `crm/fieldPassportActions:getFieldPassportFile`
  (through `crm/fieldPassports:authorizeFieldPassportRead`, before any audit row is written) and
  `crm/finance:createExpense` when it carries a `clientRef` and a `jobCardId`. A retry of an
  expense already recorded with the same `clientRef` still returns its id, because it writes
  nothing; only a new expense is refused.
- The trip-pack reads the app shares with the Staff Workspace accept an optional
  `surface: "connect"`. With it they refuse an off trip with `"APP_PILOT_OFF"`; without it they
  behave as before. They are `crm/jobCards:getCommandCenter`, `crm/jobCards:listTravelBatches`,
  `crm/jobCards:getDetail` (the notification screen), `crm/travellers:listPage` and
  `crm/ops:listTourManagers`. With `surface: "connect"` the last two need a `jobCardId` the
  caller can see (`FORBIDDEN` otherwise), which the app always passes.

**Why an argument on the shared reads.** The server cannot tell the app from a browser session,
and the Staff Workspace calls the same five reads for staff and external tour managers. Gating
them for every caller would take the trip out of the CRM too, which the decision rules out. So
the app opts in with `surface: "connect"`. This is not a new security boundary: a caller who
leaves the argument out gets exactly what the CRM already gives them. The data that exists only in
the app (field sync, field passports, the offline expense outbox and the trip list) is refused
unconditionally.

**Not gated.** The office readers `crm/fieldSync:listLatestHeadcounts`,
`crm/fieldSync:listAnnouncements` and `crm/fieldPassports:listFieldPassportAccess` are Staff
Workspace views and keep working, as do expenses created without `clientRef`. The app's other
calls (`crm/staff:getMyPortalAccess`, `crm/activity:listNotifications`, `crm/finance:listExpenses`,
`crm/finance:getExpenseListRow`, the expense attachment actions and
`crm/finance:submitExpenseForApproval`) do not check the pilot. They are shared with the Staff
Workspace, where Finance and the tour manager work on the same expenses, and they were outside the
decision's list. So an expense recorded before the pilot stopped stays visible in the app, and the
outbox can still attach its proof and submit it.

**App changes this needs** (citius-app, after this server revision is deployed; the server
rejects the new argument before then):

1. Pass `surface: "connect"` on the five shared reads above.
2. Treat `APP_PILOT_OFF` from any call as "this trip is not in the app": drop the trip, its saved
   trip pack and its pending field-sync items, and do not retry them. An offline expense whose
   create is refused this way was not recorded and needs a message to the tour manager.
3. Drop a saved trip pack whose Job Card no longer appears in `listMyAssignedPage`.

## Deploy notes

- Schema changes are additive: optional `jobCards.legacyTourManagerNames`, three tables (`fieldHeadcountStops`, `fieldAnnouncements`,
  `fieldPassportAccessAudit`), optional `expenseEntries.clientRef`, and indexes
  `expenseEntries.by_createdBy_and_clientRef` and
  `tourManagerAssignments.by_staffId_and_status_and_jobCardId`. No backfill.
- Job Card deletion removes field headcounts and announcements.
- External tour manager logins (7 Nov 2026) add three optional fields,
  `staffUsers.externalTourManagerProfileId`, `externalTourManagerProfiles.staffId` and
  `jobCards.externalTourManagerStaffIds`, and narrow `jobCards.assignedTourManagerStaffIds` to
  employees. No index. Run the bounded, secret-gated
  [external-logins backfill](migrations/job-card-external-tour-manager-logins.md) on each
  deployment after this revision; before it, no deployment holds an external login, so it is
  expected to find nothing to change.
- Run the [Tour Manager legacy-names backfill](migrations/job-card-tour-manager-legacy-names.md)
  and the [assigned Tour Manager backfill](migrations/job-card-assigned-tour-manager-staff-ids.md)
  on each deployment. Until they run, untouched Job Cards still grant Job Card-level access by
  `tourManagerName`, which can hold an external profile's name.
- The traveller list's "Passport expiry" filter is shown to visa and ticketing staff and hidden
  from a Tour Manager alone; the Passport documents view never sends the expiry-urgency filter
  without Staff Workspace passport access.
- `fieldPassportAccessAudit` gains optional `retainUntil` and index `by_retainUntil`; rows written
  before it are purged by the same job once their trip is over. The new operational control
  `jobs.purge_field_passport_audit` is on by default.
- The per-trip app pilot (7 Nov 2026) adds optional `jobCards.appPilot`. No index, no backfill.
  **Every existing Job Card starts with the pilot off, so on deploy tour managers lose the app for
  every trip until someone presses Start pilot on it.** That is intended. The Staff Workspace is
  unchanged. Deploy the server before the app build that sends `surface: "connect"`.
