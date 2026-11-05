# Traveller feedback requests

## Staff workflow

Post-tour feedback defaults to Traveller feedback. Staff with ordinary JC access and an existing operations, traveller, tour-manager or JC management permission create a request for that JC. They choose the trip label travellers see and a 7, 14 or 30 day lifetime. The default is 14 days. The resulting link is shown once for copying; no email or message is sent. Operators can revoke active links. Creating another request does not reopen a revoked one.

Active staff can read safe responses and private photos in the Staff Workspace, attached to their JC. The shared projection contains the respondent's optional name, comments, dates and minimal tour context. It omits respondent email. Link management continues to require ordinary JC scope. Internal Tour manager reports remain a separate tab and are not substitutes for traveller responses.

## Traveller workflow and access

The traveller opens `/tour-feedback#<secret>`. The secret is random, expires, is revocable and is stored only as a SHA-256 hash. The URL fragment is not sent in HTTP request URLs. The client passes the secret only in an Authorization header to fixed server-configured feedback endpoints. Runtime analytics and speed collection are disabled on this page, and API responses use no-store and no-referrer.

Possession of the link permits submitting feedback for that one request. It does not grant an account, Journey Entitlement, access to a JC, guest list, financial data, staff notes, other responses or photo downloads. The public form returns only the chosen trip label, expiry, categories and photo limits. No public response-read or photo-read API exists. Production links require an explicit authorized staff action after deployment; local review requests are isolated loopback fixtures.

Travellers can skip any of six questions: overall experience, what went well, what could improve, itinerary, hotel stay, and food/restaurants. Every question is marked optional. One comment with non-whitespace text anywhere in the form is enough to submit; each answer allows up to 2,000 characters. The shared 64 KiB JSON ceiling accommodates multilingual answers. Name is optional, with a 120-character limit, and the UI does not request contact details or a rating. The backend accepts an optional email for future approved callers but keeps it out of shared output. Feedback never grants promotional consent or enrolls a person in mailers.

## Photos and failures

After saving, travellers can optionally attach up to eight still JPEG, PNG or WebP photos, 4 MiB each. A response receipt permits attachments only to that response and request. Full decoding validates the file and pixel bound; normalization strips EXIF/GPS and creates a bounded 640 px thumbnail. Both image versions are privately delivered to active staff through the existing file policy. No raw storage URLs are exposed.

Text retries use a stable per-page receipt. Photo retries use a server-computed content digest scoped to the response and return the canonical photo count, including after a committed upload whose response was lost. Duplicate processing blobs are removed. Expiry and revocation are checked before replay or storage association, including after processing. Failed saves retain typed comments; failed photo uploads keep saved comments.

Server limits bound request creation, revocation, form reads, submissions, photo attempts and total responses per request. JC deletion and E2E cleanup remove responses, request hashes and both photo variants. Creating a new link after losing the one-time copy is a deliberate staff action; existing hashes cannot reconstruct the original secret.

## Separate contact and marketing workflow

Traveller Master stores private guest name, cell number and email within existing traveller/JC roles. A one-recipient thank-you mailto draft is available for a valid email; the staff member reviews and sends it in their mail app. Promotional permission is separate: not recorded, explicitly granted with evidence, or withdrawn. The record includes actor/time. Changing an opted-in email resets permission. No bulk campaign, delivery provider or automatic enrollment is implemented.
