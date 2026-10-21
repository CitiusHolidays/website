# U13. Internal post-tour feedback and learning form

Open Feedback beside the JC number, then Internal tour report. The form stays in
Citius Connect. The Job Card selector opens the selected trip's report. Earlier
team notes and traveller feedback remain separate choices, with their existing
permissions, photos, consent and guest request links.

These pictures show the actual local app with designated synthetic accounts.
The signed-in workflow passed on `3b76a8fbe72e9accbd41b8314d198580e28dc068`.
Next's supported session-only Hide control removed its development badge after a
check reported no application errors. These are local-development captures, not
production or mailbox-delivery proof. GitHub's native PR attachment feature hosts
the pictures; every returned image URL opened and decoded successfully.

| JC dropdown | On a phone |
| --- | --- |
| ![JC dropdown](https://github.com/user-attachments/assets/74224976-05cb-41c5-8e5e-ced3c093f2a6) | ![Phone dropdown](https://github.com/user-attachments/assets/b1073b3c-0a2b-456c-a7bf-eedc13db2424) |

## The six sections

Tour details start from the JC and stay editable as a report snapshot. The form
has five separate 1–5 performance ratings, highlights, Hits and Misses, six
supplier ratings, closure choices, and a final assessment with a separate 1–10
score. N.A. is available only for suppliers. Scores of 1 or 2 reveal the issue
and future-recommendation question. Additional or pending closure work reveals
the amount, reason and responsible-person field. No example selections are
submitted automatically.

| Tour details | Five distinct performance ratings |
| --- | --- |
| ![Tour details, phone section crop](https://github.com/user-attachments/assets/db62f605-9980-4f02-9636-11c991afd353) | ![Five distinct performance ratings, phone section crop](https://github.com/user-attachments/assets/8e3fc902-f2a3-4f9d-9ef1-2e3b52c335f7) |

| Hits | Supplier rating and low-score follow-up |
| --- | --- |
| ![Hits, Misses and issue learning, phone section crop](https://github.com/user-attachments/assets/29a63681-e137-450c-acdf-dc873a9819a4) | ![Supplier rating and low-score follow-up, phone section crop](https://github.com/user-attachments/assets/b27c4b63-b00f-4b08-b33a-77ebeb665342) |

| Closure choices and pending owner | Final assessment and server-derived ownership |
| --- | --- |
| ![Closure choices and pending owner, phone section crop](https://github.com/user-attachments/assets/e6c33a0d-f7f2-4753-8cbf-1d5b8ab98d11) | ![Final assessment and server-derived ownership, phone section crop](https://github.com/user-attachments/assets/629802a0-37ce-45f6-b336-c4013819b4dd) |

The six section pictures are crops from the actual 390-pixel phone layout.
[Full desktop draft](https://github.com/user-attachments/assets/2c1e1230-1202-4c23-8d7f-975d32d21679) and [full phone draft](https://github.com/user-attachments/assets/86f36631-6909-44bf-a627-8692d9368315) show the scrollable form.

## Save, submit and read

Save draft sends no alert. Submit records the authenticated preparer and server
date, then shares the submitted snapshot with CRM staff. Drafts remain limited
to current authorized preparers and Admin. Only assigned Tour Managers, the
assigned Operations owner and Operations Head can prepare. Existing record and
Cement scope remain. Directors and Admin do not gain preparation rights from
those roles alone. Reading feedback grants no underlying JC or customer access.

Unsaved edits return when switching feedback tabs or JCs in the loaded app.
Save a draft before closing or reloading. Pending saves pause controls; a failure
retains the draft for retry. Report identity and revision checks prevent a stale
form from overwriting another session or a replacement report.

[Submitted report on a phone](https://github.com/user-attachments/assets/fef40b7f-f24f-456a-bb7b-185c1e66fd58) and [unrelated HR staff reading the submitted report](https://github.com/user-attachments/assets/113f07dc-4bb0-42fb-ab8f-e84fa2379cc9) show the read-only result.

Submission alerts use the existing durable pipeline. Only active Directors,
Finance Heads and the related Sales/Contracting people receive them. No Admin,
whole Finance team, unrelated head or extra email-alert subscription is added.
Missing owners produce no guessed recipient. Overlapping roles deduplicate.
Delivery rechecks current responsibility and record state. Email carries a JC
reference and authorized report link, without answers or financial/free-text
contents. No real message was sent during these checks.

## Admin archive and restore

Admin can archive with explicit confirmation. It hides the report, retains its
snapshot and audit trail, and cancels pending submission-alert eligibility.
Restore sends no new alert and cannot overwrite a newer current report. The
legacy note author/director moderation rules stay unchanged.

![Actual Admin confirmation](https://github.com/user-attachments/assets/a4f57764-643a-44e7-8976-a7f673690feb)

[Archived report and restore option](https://github.com/user-attachments/assets/3b146eca-8146-4dd5-9d63-ccfe46617e32). The local test first verified that a Directors-only account had no archive
action. It temporarily added Admin to that existing synthetic credential for the
archive/restore steps, then restored the original roles. No credential was created.

## Requirements and verification

| Requirement | Test and picture |
| --- | --- |
| F01. JC dropdown and existing/new report | Signed-in `post-tour-report.spec.ts`; desktop/phone dropdown above. Missing JC and deleted records have schema-backed denials. |
| F02. Prefilled, editable tour snapshot | Signed-in form and date controls; `postTourReportContent.test.ts` validates dates/guests/options. Stored report does not write JC fields. |
| F03. Five performance ratings and highlights | Section 2; independent validation keeps 1–5 separate from final 1–10 and rejects zero/fractional/out-of-range values. |
| F04. Hits, Misses and the three issue questions | Section 3; validation requires issue/resolution/future action for a selected Miss. |
| F05. Six suppliers, N.A. and low-score follow-up | Section 4; validation and mounted tests exercise 1–2 versus good/N.A. behavior. A controlled broken condition was caught and restored. |
| F06. Financial/operational closure | Section 5; conditional-field validation requires the amount/reason/owner when additional or pending work is selected. No calculation or approval change. |
| F07. Final assessment and authenticated ownership | Section 6 and submitted report; schema-backed test asserts the server actor/date and distinct final score. |
| F08. Preparers, narrow drafts and all-staff submitted read | Seven schema-backed report cases, real Operations/HR/Directors sessions, Cement scope and unprovisioned customer denial. Full JC access remains denied to HR. |
| F09. Exact submission audience and retries | Schema-backed exact bell/email addresses, overlapping-role dedupe, reassignment, inactive roles and archive cancellation. Adding Admin deliberately broke the test, then passed after byte-for-byte restore. |
| F10. Admin-only recoverable deletion | Actual confirmation and archive/restore above; Directors denied. Audit and replacement conflicts have backend assertions. |
| F11. Failed save, navigation, duplicate and stale saves | Five mounted cases and signed-in draft/tab/save/submit flow. ID/revision test rejects a stale replacement at the same revision. |
| F12. Existing feedback and unrelated workflows | Legacy feedback tests remain; no migration or narrative-to-rating conversion. The complete local gate and exact published CI are recorded in the PR. |

<details>
<summary>Reproducible checks and limits</summary>

Use the repository's Bun 1.4.0. Run `bun run verify:local`,
`bun run test:convex convex/crm/postTourReports.convex.integration.ts`,
`bun test --isolate convex/lib/postTourReportContent.test.ts src/components/portal/postTour/StructuredPostTourReport.mounted.test.jsx`, and
the guarded local `playwright test e2e/specs/post-tour-report.spec.ts --workers=1`
setup in `docs/E2E_TESTING.md`. The latter requires the designated synthetic
accounts, exact frontend/backend identity, test ownership and loopback isolation.
No hosted Preview or new credentials are required. Logs, screenshot originals,
source hashes and generated evidence JSON stay ignored locally.

The signed-in flow is one multi-step test, not exhaustive route acceptance.
The existing local fixture JC has no related Query or Finance Head. Its browser
check proves the Directors notice and absence of unrelated/whole-team notices;
Finance Head matching and related-owner addresses have deterministic schema-backed
proof. Queued email is suppressed during the active local E2E run. Provider
acceptance, mailbox delivery and production configuration are not claimed.

The native Notes repeated-update error from the earlier review remains unisolated.
This report does not claim to fix it. No merge, production deployment, real
employee/customer send, new credential or analytics change was used.

</details>
