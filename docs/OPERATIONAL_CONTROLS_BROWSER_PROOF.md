# Operational controls browser proof matrix

This matrix is a future execution checklist. It does not authorize a deployment, release setup,
Preview mutation, or Production mutation. Record local, Preview, and Production evidence
separately; never promote evidence from one target to another.

Before executing against Preview, obtain authority for the exact deployment and source revision,
confirm the target banner matches both, provision an exact Admin identity, and confirm Automatic
Restoration can run on that target. Production requires a new, separate authorization.

| Surface | Browser proof | Required evidence |
|---|---|---|
| Authorization | Admin sees both surfaces; Director and other roles do not mount or query them. | Identity, role, target banner, denied network response. |
| Target identity | Banner distinguishes Preview or Production and shows deployment plus source revision. | Screenshot and copied target values. |
| Catalog scale | At 390px and desktop width, search and Paused, Temporary, Blocked, and Changed filters retain all content. | Screenshots at both widths and keyboard traversal notes. |
| Configured versus blocked | Pause a master channel in an authorized disposable target; dependent controls stay configured Available and show the named block. | Before/after catalog and receipt. |
| Review and Apply | Stage, amend, discard, then atomically apply multiple controls with a long multiline reason. | Review panel, one change-set ID, one audit ID, refreshed state. |
| Automatic Restoration | Apply each supported duration and confirm the server-derived deadline matches 30 minutes, 2 hours, or 24 hours; observe one short-lived change return to the exact preceding state. | Apply receipt, server timestamp and deadline, restoration activity, resolution audit, final catalog. |
| Undo | Undo only the newest applicable change with a new reason; repeat and historical attempts are unavailable. | Undo review, receipt, single Undo audit, rejected repeat. |
| Test Lab safety | Run all eight major-feature recipes and each of the twelve selectable scheduled-job checks. No CRM row, notification, email, provider request, order, file, publication, scheduler enqueue, or job write occurs. | Run IDs, ordered steps, redacted effects, independent domain counts. |
| Test recovery | Start a run, reload while it is Running, confirm inputs are locked, then Resume the same run. Separately, age an interrupted run beyond 15 minutes and confirm the next overlapping start records it as Failed before creating one replacement. | Original and replacement run IDs, the interrupted failure evidence, and final evidence records. |
| History scale | Search loaded change, restoration, Undo, test, and effect history; paginate beyond twelve rows. | Search results and older-page evidence IDs. |
| Accessibility | Complete actions with keyboard only, verify focus return, live status, 44px targets, 200% zoom, 20px root font, and reduced motion. | Screen-reader notes, focus sequence, screenshots. |

After execution, attach exact timestamps and immutable evidence IDs. A passing source gate without
this journey remains source-only proof.
