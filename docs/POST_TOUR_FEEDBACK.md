# Internal tour-manager reports and guest contacts

These workflows belong to the existing Citius Connect Staff Workspace. They do
not create a separate application or change Customer Travel Account access.

## Feedback

Open **Post-tour feedback** from the Job Cards navigation group, or follow the
feedback link on a Job Card. Select a JC number to read its reports. Each entry
has a category, comments, author, date, optional vendor name and rating, and
photos. Categories cover overall experience, what went well, improvements,
itinerary, hotel stay, and food/restaurants. Use separate entries for separate
topics or vendors. An unrated or inapplicable vendor has no numeric rating;
zero is not a valid rating.

The supplied post-tour report informed these categories. This first scope does
not reproduce its billing, refunds, supplier reconciliation, or formal report
approval sections. Existing JC client, destination and dates provide context.

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

The schema adds two feedback tables and optional traveller contact/consent
fields. No backfill, destructive migration, or default opt-in is needed.
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

Traveller-facing feedback is the primary Post-tour feedback workflow; see [Traveller feedback requests](TRAVELER_FEEDBACK.md). Internal manager reports remain a separate tab.
