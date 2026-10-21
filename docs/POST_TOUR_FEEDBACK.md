# Internal tour-manager reports and guest contacts

These workflows belong to the existing Citius Connect Staff Workspace. They do
not create a separate application or change Customer Travel Account access.

## Feedback

### Structured internal tour report

Open **Feedback** beside a JC number in the Job Card list or detail, then
**Internal tour report**. The same workspace has a Job Card selector. This is an
in-app report, not an external feedback invitation.

One current structured report belongs to each JC. Its six sections cover tour
details, five separate 1–5 performance ratings and highlights, Hits and Misses,
six supplier ratings, financial/operational closure, and a final assessment.
The final tour rating uses 1–10. Supplier N.A. is a separate value; zero is
invalid. Scores of 1 or 2 require the issue and future recommendation. Good or
N.A. suppliers need no comment. Additional or pending closure work requires the
amount, reason and responsible person. No approval stage or calculation is added.

Client, destination, dates, guests and assigned manager names start from the JC.
The report keeps an editable snapshot, rather than changing the JC or adopting
later JC edits silently. Prepared-by and submission time come from authenticated
staff identity and the server. No client-supplied identity or submission date is
accepted.

Assigned Tour Managers can prepare and submit using the existing identity-first
assignment rules. The existing assigned Operations/Operations Cement owner and
Operations Head are the Operations Manager equivalents. Their existing record
and Cement scope checks remain. Directors or Admin alone do not gain preparation
rights. Current preparers and Admin can read a draft; other CRM staff can read
only submitted reports. This feedback-only exception grants no full JC, guest,
customer, finance-record or sensitive-document access.

**Save draft** sends no submission alert. **Submit report** validates all required
answers and freezes the submitted snapshot. Five performance ratings stay distinct
from the final 1–10 score. Unsaved edits survive the feedback tabs and JC changes
within the loaded app, scoped to the current staff member and JC. Failed saves
keep the draft. Save before closing or reloading the browser. Pending commands
block edits and duplicate submits. Report ID and revision checks reject stale
saves, including after an archive/replacement.

Submission publishes one durable bell/email event to active Directors, staff
identified by the existing Finance Head function, the related Sales owner and
the JC Contracting owner. The linked Query Contracting owner is used only when
the JC has no Contracting owner. Missing owners do not trigger a team or head
fallback. Admin, general Finance staff, unrelated heads and email-alert role
subscriptions are not added. Overlapping roles deduplicate. Delivery rechecks
current responsibility, active status, report state and access. Email contains
the JC reference and a report link, without financial or free-text answers.
Existing operational controls and delivery/retry rules remain.

Only Admin can **Archive report**, with the existing explicit confirmation.
Archive hides the report and cancels pending submission-alert eligibility.
Nothing is purged. Admin can read and restore archived snapshots; restoring sends
no new alert and cannot overwrite another current report. Audit entries record
saves, submission, archive and restore. Missing/deleted JCs fail closed. No new
JC-deletion permission or destructive migration is introduced.

### Earlier team notes

The **Earlier team notes** tab retains category/comment/photo entries. Each
entry has a category, comments, author, date, optional vendor name and rating,
and photos. Categories cover overall experience, what went well, improvements,
itinerary, hotel stay, and food/restaurants. Use separate entries for separate
topics or vendors. An unrated or inapplicable vendor has no numeric rating;
zero is not a valid rating. These legacy entries are not converted into the
structured report and no ratings are inferred from their narratives.

All active, provisioned staff can read feedback and its limited JC context.
This is an explicit feedback-only exception to ordinary record scope. It does
not grant access to full Job Cards, commercial records, guest contacts, or
sensitive travel documents. A JC with no feedback is selectable only through
the reader's existing JC access or tour-manager assignment.

Tour managers assigned to a JC can add feedback and photos. The author can
edit or delete their own entries while still assigned. Admin and director
roles can moderate existing entries. Explicit staff-linked assignments take
precedence over legacy names. Name-only legacy assignments retain the existing
fallback without overriding a conflicting staff identity.

Save comments before adding photos. Each entry supports up to eight still
JPEG, PNG or WebP photos, at most 4 MB each. The server checks authorization
before accepting the image and again before attaching it. It fully decodes
the image and removes camera metadata. Photos use authenticated same-origin
delivery. Gallery previews are separate metadata-free JPEGs, at most 640 pixels
and 256 KB, with a 240-per-minute staff limit. Manual downloads retain the
existing 30-per-minute limit. Failed processing removes the original upload.
Guest contact data and private documents do not belong in feedback.
Removing feedback or its JC cleans up the linked photos and stored files.

## Guest contacts and email

The existing traveller editor stores the guest's name, cell number and email.
The existing traveller permissions and JC record scope govern reads and edits.
Imported cell numbers remain compatible. Missing email and consent fields on
legacy records remain valid and display as blank and **Not recorded**.

**Draft thank-you email** opens one guest's address in the operator's email
application with an editable thank-you message. The operator reviews and sends
it there. Saving contacts never sends an email, subscribes a guest, or creates
a marketing audience.

Promotional permission is recorded separately as **Not recorded**, explicit
opt-in, or withdrawn. Opt-in requires a note recording how and when the guest
gave permission. Changes record the staff actor and timestamp. Changing an
email that had permission resets it to **Not recorded**. These fields store
evidence for a possible later workflow; they do not enable promotional sending.

## Release and verification boundary

The structured report adds `postTourReports` alongside the existing feedback
tables and optional traveller contact/consent fields. No backfill, destructive
migration, or default opt-in is needed.
Deploy the reviewed schema and backend together before the frontend. Retain
the optional fields if rolling the frontend back so recorded data remains
available. No production migration or deployment is implied by local checks.

Target-neutral checks cover schema-backed APIs, staff and assignment denials,
image validation, deletion cleanup, contact validation, consent handling,
mounted editor recovery, and the authenticated upload proxy. Local acceptance
also exercises the integrated routes, normal sign-in, role denials, real image
processing, private delivery and guest-contact editing on an isolated loopback
backend. Desktop and 390 px browser captures use fictional records; the named
test run is cleaned afterward. Hosted acceptance and production rollout remain
separate reviewed actions.

Traveller-facing feedback remains a separate tab and retains its existing request links, consent, submission and photo workflow. See [Traveller feedback requests](TRAVELER_FEEDBACK.md). The new internal-report dropdown does not remove guest feedback links.
