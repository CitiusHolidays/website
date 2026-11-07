# ADR 0019: Customers delete their own account in one auditable transaction

- Status: Accepted (owner decision, director, 7 Nov 2026)
- Scope: Customer Travel Account on the website now; the same Convex contract serves the customer
  app later (the App Store requires in-app deletion)

## Context

Account settings sent customers to `/contact?intent=account-deletion` and the team deleted
accounts by hand. The owner decided customers can delete their own account. A customer's data
lives in three places: the Better Auth component (user, sessions, linked accounts, verification
tokens), app tables keyed by the canonical identity or its linked legacy id, and operational CRM
records that belong to Citius, not to the login. Staff log in through the same Better Auth, so
"delete my login" must never reach a staff record.

## Decision

`accountDeletion.deleteMyAccount` (a Convex mutation) deletes the caller's account in one
transaction, so it either completes or changes nothing.

**Before anything is deleted** the server checks, in order:

1. An authenticated identity (`UNAUTHORIZED`).
2. An existing receipt for this identity. If there is one, it returns that receipt unchanged, so a
   retry is safe.
3. Not a staff login (`STAFF_ACCOUNT_DELETION_REFUSED`): no `staffUsers` row for the identity or
   for the login email, active or not. The person is told to contact HR.
4. The typed confirmation `DELETE` (`ACCOUNT_DELETION_CONFIRMATION_REQUIRED`).
5. A recent sign-in (`REAUTHENTICATION_REQUIRED`): the token's `sessionId` must name a live
   session of this user created within the last 10 minutes. Signing in again satisfies it, with
   a password or with Google.
6. A clean identity link (`AUTH_IDENTITY_CONFLICT`): a quarantined legacy link goes to support,
   because another person may own those legacy rows.

**Deleted:**

- The Better Auth user, every session (every device signs out), every linked account (password
  and Google) and every live verification token (for example an unused password-reset link) whose
  value is the user id. The verification table has no index on that value, so the deletion walks
  only unexpired tokens through the `expiresAt` index; an expired token cannot be used and names
  only the deleted user id.
- Customer profiles keyed by the identity, plus archived duplicates provably tied to it (archived
  owner id, or merged into a deleted profile). This includes saved passport details and the
  leaderboard preference.
- Identity links for the identity.
- Sacred Bharat: the Yatri profile, the leaderboard entry, visits, the wishlist (saved temples and
  trails), the invite throttle row and group memberships. A group the person owned is archived,
  renamed "Archived group" and detached; other members keep their own memberships. Joined groups
  get a recounted member total.

**Kept, detached and anonymised:**

- Bookings and their payment events, for 8 years under tax rules. `userId` becomes
  `deleted-account:<digest>` and the purchaser's free-text `notes` is removed. Identity documents
  are stripped from the checkout `travelerDetails` (owner decision, 7 Nov 2026): any key, at any
  depth, for a passport, a document expiry, a national ID (including Aadhaar) or a date of birth.
  The details are free-form JSON, so keys are matched by name (`convex/lib/bookingTravellerDocuments.ts`).
  Names, contacts, nationality, amounts, payment ids, status, dates, trip and traveller count
  stay for the invoice and accounting.
- Journey Entitlements are revoked (`revokedAt`), their owner becomes the same tombstone and the
  profile link is removed. The row stays as the grant's audit trail.
- Invoices, Job Cards and Job Card Travellers are untouched; they belong to the operation and were
  never keyed to the login. Enquiries, content-free email receipts and staff records are untouched.

**Receipt:** one `accountDeletionReceipts` row: `subjectHash` (SHA-256 of a domain prefix plus the
canonical identity), `deletedAt`, per-store counts and the confirmation email status. It holds no
name, email, identifier or booking detail. The customer sees the first 16 hex characters as their
reference.

**Feedback photos:** no website photo store records a customer account as its author. Post-tour
feedback photos are staff-authored and traveller-feedback photos come from a token link with a
typed email, which is not account authorship. The receipt reports `feedbackPhotos: 0`. When the
customer app adds photos authored by an Account Holder, it must key them to the identity and
`eraseCustomerAccount` must delete them.

**A still-valid token cannot bring the account back.** A Convex token outlives its deleted session
for a few minutes. `establishCanonicalIdentityLink`, which the customer write paths that act for
the signed-in identity go through (profile, bookings, Sacred Bharat, groups), refuses with
`ACCOUNT_DELETED` once a receipt exists for the identity. `authSync.syncFromIdentity` is only
scheduled when Better Auth creates a user or session, which cannot happen for a deleted user.

**Confirmation email:** after commit, `accountDeletionEmail.sendConfirmation` sends "Your Citius
Holidays account was deleted" through the transactional auth email path with purpose
`account_deleted` and operational control `email.auth.account_deleted`. It fails closed: no
provider key, or the control off, records `skipped`; deletion never waits for the email. Once
the control plane is active, a new control resolves to disabled until an Admin sets it, so the
release must set `email.auth.account_deleted` to Default or Enabled. The recipient address is
an argument of the scheduled email job, so Convex keeps it in the scheduled-function record until
that record is cleaned up (days); nothing else keeps it. The web success message therefore does
not promise an email.

**One erase for every account deletion.** `eraseCustomerAccount` (`convex/lib/accountErasure.ts`)
is the only implementation. Self-service deletion calls it for the token's identity; the inactive
account retention job (`jobs.purge_inactive_customer_accounts`, `docs/DATA_RETENTION.md`) calls it
for an idle profile. The callers differ only in what they pass: the tombstone written into kept
records (`deleted-account:<digest>` vs `retention:deleted-account`) and whether journey
entitlements are revoked (self-service, keeping the audit trail) or deleted (retention).

**Owner answers (7 Nov 2026).** Feedback photos stay as built: a matching email is not ownership.
The recipient address in the scheduled email job is acceptable. Owned Sacred Bharat groups are
archived. "Sign in again" returns the customer to `/account?tab=settings#delete-account` through
the guest sign-in's `returnTo`, which accepts only a same-origin path inside `/account`.

## Customer app contract

The app calls the same Convex functions with its Better Auth token (ADR 0009). There is no
separate app route.

| Function | Args | Returns |
| --- | --- | --- |
| `accountDeletion:getMyAccountDeletionEligibility` (query) | `{ referenceNow: number }` (the caller's clock, ms epoch; queries do not read the clock) | `null` (signed out), `{ status: "staff_account" }`, `{ status: "reauthentication_required" }`, or `{ status: "ready", reauthenticateBy: number }` (ms epoch). Advisory only; the mutation enforces. |
| `accountDeletion:deleteMyAccount` (mutation) | `{ confirmation: "DELETE" }` | `{ status: "deleted", deletedAt: number, reference: string }` |

Errors are `ConvexError` with string data: `UNAUTHORIZED`, `STAFF_ACCOUNT_DELETION_REFUSED`,
`ACCOUNT_DELETION_CONFIRMATION_REQUIRED`, `REAUTHENTICATION_REQUIRED`, `AUTH_IDENTITY_CONFLICT`,
`ACCOUNT_DELETION_TOO_LARGE` (more than 1,000 rows in one store; support deletes it). The phrase,
the 10-minute window and the codes live in `convex/lib/accountDeletionContract.ts`.

The app must: show what is deleted and kept (the web copy in
`src/components/account/AccountDeletionSection.tsx` is the reference); on
`reauthentication_required`, sign the user in again and call again within 10 minutes; after
success, clear its stored session and cached trip data. A retry after a lost response returns the
same result while the token lasts; after that the user is signed out and the account is gone.

The website reaches the same mutation through `GET`/`POST /api/account/deletion`, which uses the
Better Auth cookie and maps the codes to plain messages. `/contact?intent=account-deletion`
forwards to `/account?tab=settings#delete-account`.

## Consequences

- Deletion is bounded to 1,000 rows per store in one transaction; a customer account is far
  below that.
- Adding customer-owned data later means adding it to `eraseCustomerAccount` and its integration
  test in the same change.
- Better Auth's own `/delete-user` endpoint stays disabled; it would skip the staff refusal and
  the app-side erasure.
