# Citius Event Photo Booth

Status: implemented on the feature branch in [PR #292](https://github.com/CitiusHolidays/website/pull/292),
pending review and deployment. Includes the Admin/Director availability exception.
This document records product intent. It is not evidence that
the feature works. GitHub Issues remain canonical for implementation specifications and status.
Canonical implementation specification: [#286](https://github.com/CitiusHolidays/website/issues/286).

## Purpose

Visitors can create and share a Citius-branded destination photo, then choose whether to make a
travel enquiry. A QR code on a physical Selfie Point opens the event-only website experience. Anyone with
the link can participate while it is Open, without login, an event code or a contact form gate.

The experience belongs to the Citius Holidays public website. It does not adopt the reference
artifact's WhatsApp-first bot workflow or become a Sacred Bharat quiz, Customer Account feature,
permanent photo editor or CRM photo archive.

## Visitor experience

1. Open the event link and use the English or Hindi interface.
2. Choose Travel or Pilgrimage, then a predefined Destination Scene.
3. Add a solo, couple or small-family photo from the phone.
4. Remove its background while preserving actual faces and clothing. Automatically place the
   people in the selected scene; allow move/resize, reset, change photo and scene switching without
   requiring the Source Photo again.
5. Preview the result. If the cutout is unsatisfactory, retry/change photo or explicitly choose a
   whole-photo branded frame that preserves the original background. Never silently substitute it.
6. Export either 4:5 portrait or 9:16 Story. Offer Download and native Share with usable fallbacks
   for unsupported devices. Save/share within the current session; remind the visitor before reset.
7. Optionally choose "Plan a trip here" to open the existing enquiry flow with the chosen destination.
   Create a lead only on explicit submission. The enquiry never includes the participant's photo.

Native sharing is a device/app handoff, not confirmed publication. Connected-account Social SDK
publishing is not part of this flow. No personal result links, photo history or social-account login.

## Event management

Use the existing Staff Workspace baseline, with a dedicated event-management capability:

- Admins, Directors and explicitly assigned event staff can operate the booth, publish scene changes
  and view its aggregate usage.
- Only Admins and Directors can grant or revoke Event Staff Assignments for existing staff accounts.
  An assignment does not change a staff member's job role or broader permissions.
- Authenticated, active Admins and Directors can use the participant photo experience while the
  event is either Open or Closed. The server verifies this exception; a URL parameter or client role
  assertion cannot grant it. Assigned event staff retain management access while Closed but do not
  inherit this participant bypass from assignment alone.
- One event configuration initially, with a manual **Open / Closed** control. No scheduling, start/end
  times or separate pause state. Closed retains a useful page and travel links at the printed QR URL.
- Add, edit, hide and reorder scenes; upload artwork; edit English/Hindi text; preview both export
  formats; view aggregate usage.
- Visitor photos are never visible to staff. Existing production operational controls are not a scene
  editor, and their global permissions or behavior must not be broadened for this feature.

## Initial scene set and artwork

| Travel | Pilgrimage |
| --- | --- |
| Paris | Kashi |
| Bali | Ayodhya |
| Dubai | Kedarnath |

Six generated backdrop drafts ship under `public/images/event-photo-booth/`; their full-resolution
masters are preserved locally under `.scratch/selfie-point/assets/`. They use existing public-site
imagery as visual context, with open foreground placement areas and editable branding/text kept
separate from scenery. [Engine and asset provenance](../event-photo-booth/image-engine.md) records
model licences, exact hashes and output dimensions. They are not final approved campaign artwork or finished
exports. Review the artwork for accuracy and check both crops before using it at an event.

## Processing, privacy and measurement

Photo decoding, person segmentation and export run in the browser. The implementation uses a
self-hosted Apache-2.0 model and runtime with no photo-processing API or paid fallback. Temporary
hosted processing would be a separate future change only if photo testing demonstrates a need and
quality, cost and deletion terms are verified. Do not silently introduce external photo uploads.

Cost target: ideally free to run, with zero per-photo processing fees. Use browser inference/export,
cache the model and artwork, and minimize backend requests and storage. Do not add a paid service or
automatic paid fallback. Existing hosting, bandwidth, storage and database quotas still apply; report
their measured consumption rather than claiming unlimited free operation.

Keep participant photos out of persistent Citius records. No gallery, staff recovery, marketing reuse
or photo attachment to a lead. Retain only the operational content and aggregate usage needed for the
event: visits, completed photo creation, download actions, share attempts and destination-enquiry
entry. These counts do not establish unique attendance, completed downloads or published social posts.

See the [glossary](../event-photo-booth/CONTEXT.md) and
[photo-boundary decision](../adr/0016-keep-event-photos-outside-staff-management.md).

## Unverified release conditions

- Event date, expected traffic and any processing spending ceiling are unknown.
- Browser cutout quality and practical group-size limits require real solo/couple/family test photos,
  including hair, overlapping people, glasses, children, busy backgrounds and low light.
- Prove performance on representative iPhone/Android devices and weak mobile data, including the
  initial 28,607,663-byte raw model/runtime download. Licences and hashes are checked in; hosted
  transfer compression, cache behavior and bandwidth consumption still require target-specific proof.
- Local component/engine browser checks cover real inference, both exports, cancellation/retry,
  failed model download with explicit frame recovery, English/Hindi, keyboard controls, 320px/390px,
  20px root text, dark preference and reduced motion. They use controlled DTOs and synthetic adults;
  they do not prove physical camera/gallery behavior or native installed-app sharing.
- Schema-backed tests cover staff authorization/assignment boundaries, safe publication, Open/Closed,
  metrics and artwork isolation. Verify the authenticated journeys and consented enquiry on the
  named deployment before opening an event; source tests do not establish hosted authorization.
- Provisioning the server-only metrics secret, Convex Sharp loading, full Next integration and
  updated Staff Workspace performance evidence require separately authorized target-specific work.
- Final asset/visual approval, local checks, Git publication, hosted proof and deployment authority
  remain separate states. This document does not establish a deployment.
