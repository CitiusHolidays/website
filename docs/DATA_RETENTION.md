# Data retention schedule

The director approved this schedule on 7 November 2026. Each rule runs as its own scheduled job
behind its own Live Feature Control, so one can be switched on, paused or restored without the
others. **Every new job is off by default** (`standardEnabled: false`). Nothing is deleted or
anonymised until an Admin has reviewed that job's dry-run report and switched it on.

| Record | Kept for | Job and control | What the job does |
| --- | --- | --- | --- |
| Office access logs (`activityLogs`) | 1 year | `purge_activity_logs`, `jobs.purge_activity_logs` | Deletes the log rows |
| Website enquiries that never became a Query | 2 years | `purge_unconverted_enquiries`, `jobs.purge_unconverted_enquiries` | Deletes `pending` and `dismissed` inbound intents and their bell rows |
| Customer accounts | Until deleted, or 3 years idle | `purge_inactive_customer_accounts`, `jobs.purge_inactive_customer_accounts` | Deletes the sign-in, sessions, profile, identity links and journey entitlements; detaches bookings |
| Bookings and invoices | 8 years | `retire_financial_records`, `jobs.retire_financial_records` | Anonymises website bookings; deletes CRM invoices |
| Traveller records | 3 years after the trip | `anonymise_past_travellers`, `jobs.anonymise_past_travellers` | Anonymises the traveller; keeps the row |
| Passport scans | 90 days after the trip | `purge_passport_scans`, `jobs.purge_passport_scans` | Deletes the scan file and the encrypted passport details |
| Traveller feedback | 3 years | `purge_old_feedback`, `jobs.purge_old_feedback` | Deletes the response and its photos in storage |
| Field passport views (`fieldPassportAccessAudit`) | 1 year after the trip | `purge_field_passport_audit`, `jobs.purge_field_passport_audit` | Deletes the audit row (this job already existed and stays on) |

Only the Operations Head and Admin read the field passport view log
(`crm/fieldPassports:listFieldPassportAccess`).

## Shared rules

- **Office dates.** Every period is counted in India Standard Time office dates, as office
  check-ins and field passports are. A record is past its period when its office date is before
  `today − period`; the last day of the period is still kept. 29 February minus a year is
  28 February. The code is `convex/crm/lib/retentionSchedule.ts`.
- **Trip end.** The Travel Batch's own dates when the batch records a start date, else the Job
  Card's (never a mix); the end date, falling back to the start date. A whole Job Card ends with
  its latest batch. **A trip with no dates is never purged**; it shows in the reports as
  `kept_undated`.
- **Bounded runs.** Each run reads one page, applies it, and schedules the next page with the
  run's fixed time (`asOf`), following `crm/officeCheckInRetention`. No step scans unbounded.
- **Same logic for the report and the job.** The dry run and the job plan the same page with the
  same code (`convex/crm/lib/retentionRun.ts`); the report only counts.

## What each job keeps

- **Travellers.** The row stays, so passenger, room and meal counts, tickets, visa outcomes and
  invoices still add up. The name becomes `Anonymised traveller`. Removed: contact number, email,
  gender, given name and surname, special requests, companions, hotel allocation, biometric
  appointment, guardian links in both directions, the minor flag and unresolved guardian names,
  import key and import names (dealer, RSO, SO, description), the marketing consent note, and the
  passport expiry copy. Passport details and scans still left are deleted; meal preference rows are
  deleted; rooming, seat and visa notes are cleared; the traveller's bell rows are deleted.
  `foodPreference` and `roomType` are required fields that feed the Job Card's meal and room
  counts, so they stay. Tickets keep their number as a financial reference.
- **Passport scans.** The whole `passportDetails` row goes: the encrypted payload, number hash,
  last four digits, expiry date and file name. The last four digits only help staff recognise the
  right passport while it is in use; once the scan is gone there is nothing to recognise. The
  traveller keeps the content-free status word (`passportStatus`, such as `Received`).
- **Bookings.** Amounts, status, currency, traveller count, the trip and the Razorpay order and
  payment ids stay as the payment record. Removed: traveller details, notes, the payment
  signature, the account link (replaced by `retention:anonymised`) and the booking's journey
  entitlements. A booking is past the period when both its booking date and its trip's end are.
- **Invoices.** They hold amounts and a number but no personal data. One is deleted when both its
  creation date and its Job Card's trip end are more than 8 years ago; an undated Job Card keeps
  its invoices. The CRM finance metrics are told about each deletion.
- **Customer accounts.** Activity is the latest of the profile's `updatedAt` (rewritten at every
  sign-in by `authSync.syncFromIdentity`), the Better Auth user's dates, any session, and any
  booking or journey entitlement, across every identity id of the account (canonical and legacy
  ids from `authIdentityLinks`). Never touched: staff accounts (matched by id or email), accounts
  with a Sacred Bharat profile, and archived duplicate profiles. Bookings stay for the 8-year rule
  with their account link replaced by `retention:deleted-account`.
- **Enquiries.** Converted intents are never touched. The `crmHandoffEvents` row holds no personal
  data and stays for the handoff counts.
- **Feedback.** Traveller feedback responses and their photo files and thumbnails. The feedback
  link (`travelerFeedbackRequests`) holds no personal data and stays. Tour managers' post-tour
  vendor feedback is not covered.
- **Field passport views.** Each row stores the trip's passport window close (`tripClosesAt`) and
  is kept until that close plus 365 days (`retainUntil`). The job re-reads the trip's dates first,
  so an extended trip keeps its rows longer. A trip that has lost its dates keeps its rows and is
  looked at again after 30 days. A row whose Job Card is gone keeps the close it recorded.

## Running the dry-run reports

Every rule has an internal dry-run query, `<module>:dryRun`, with
`{ asOf, cursor, secret }`. It returns content-free counts for one page:
`{ counts, continueCursor, isDone }`. `secret` is the deployment's `MIGRATION_SECRET`; a wrong
secret is refused before anything is read. Outcomes starting with `deleted` or `anonymised` are
what the job would change; `kept_*` and `already_*` are left alone.

The summary action adds up the pages in one call:

```sh
bunx convex run crm/retention/reports:summarize \
  '{"job":"purge_passport_scans","secret":"<MIGRATION_SECRET>"}'
```

It returns `{ asOf, counts, pagesRead, isDone, continueCursor }`. It reads at most `maxPages`
pages (default 50, at most 200). If `isDone` is false, run it again with the returned
`continueCursor` and the same `asOf`, and add the counts.

| Job (`job` argument) | Dry-run query | Page size | Outcomes |
| --- | --- | --- | --- |
| `purge_activity_logs` | `crm/retention/activityLogs:dryRun` | 200 | `deleted` |
| `purge_unconverted_enquiries` | `crm/retention/enquiries:dryRun` | 100 | `deleted`, `kept_converted` |
| `purge_inactive_customer_accounts` | `crm/retention/customerAccounts:dryRun` | 20 | `deleted_account`, `kept_active`, `kept_staff`, `kept_sacred_bharat`, `kept_archived_duplicate` |
| `retire_financial_records` | `crm/retention/financialRecords:dryRun` | 50 | `anonymised_booking`, `already_anonymised_booking`, `kept_booking_recent`, `kept_booking_undated`, `deleted_invoice`, `kept_invoice_trip_recent`, `kept_invoice_undated` |
| `anonymise_past_travellers` | `crm/retention/travellers:dryRun` | 25 | `anonymised`, `already_anonymised`, `kept_trip_recent`, `kept_undated`, `kept_no_job_card` |
| `purge_passport_scans` | `crm/retention/passportScans:dryRun` | 50 | `deleted`, `kept_trip_recent`, `kept_undated`, `kept_no_job_card`, `kept_no_traveller` |
| `purge_old_feedback` | `crm/retention/feedback:dryRun` | 50 | `deleted_traveller_feedback` |
| `purge_field_passport_audit` | `crm/fieldPassportAuditRetention:dryRun` | 100 | `deleted`, `kept_trip_recent`, `kept_undated` |

Name the exact deployment before running anything against it. A dry run on Development or a
Preview is not evidence for Production; Production needs its own explicit approval and its own
report. Record the counts and the deployment identity, never record contents.

## Switching a job on

1. Run the job's dry-run summary on the exact target and review the counts with the owner.
2. In **Settings → Live feature controls**, find the job (for example *Passport scan retention*),
   stage it as **Available**, and apply with a reason that names the reviewed report. A temporary
   change set (30 minutes, 2 hours or 24 hours) lets the first run happen with automatic
   restoration to off afterwards.
3. The job runs at its next cron time. Daily: passport scans at 00:45 IST, activity logs at
   03:00 IST, enquiries at 03:15 IST. Weekly, early Monday IST: feedback 03:30, travellers 03:45,
   bookings and invoices 04:00, customer accounts 04:15.
4. Run the dry-run summary again; the `deleted` and `anonymised` counts should now be zero (or only
   records that became due since).
5. To stop a job, set it to **Paused**. A run that has already started finishes its current page.

The Production Test Lab lists a recipe for each job. While a job is off its recipe reports
*Skipped*; it never executes writes either way.

Deletions and anonymisation cannot be undone. Take a deployment backup before the first run of
each job on Production.
