# ADR 0020: Customer app trip invites and the traveller's own trip view

- Status: Proposed (owner and director decisions of 6-7 Nov 2026)
- Scope: the Citius customer app (`CitiusHolidays/app`, `apps/customer`), its sign-in, and the
  staff invite panel on the Job Card

## Context

A Journey Entitlement ([ADR 0013](0013-explicit-customer-journey-entitlements.md)) binds an Account
Holder to a confirmed Query, and only Sales roles could grant one, to an account that already
existed. Nothing tied an Account Holder to their own Traveller row, so the website could show the
frozen itinerary but not the traveller's group, tour managers, documents or announcements, and a
guardian could not be shown their children ([ADR 0018](0018-link-minors-to-a-guardian-traveller.md)).

The owner decided (7 Nov 2026): Operations invite travellers to the app, also in bulk; sign-in is by
email link or SMS, the traveller's choice; past trips stay visible; minors never get a login and
are seen by up to two guardians; a guardian ticks consent when accepting the invite; the app shows
a trip only once its per-trip pilot is started (`jobCards.appPilot`).

## Decision

**Invites.** Staff with `manage:travellers` who can see the Job Card create one single-use invite per
adult, not cancelled Traveller (`customerTripInvites:createInvites`, up to 50 per call). The staff
browser makes a 32-byte random token and sends only its SHA-256 hash, as the post-tour feedback
links do; the link (`/app/invite#token=…`) is shown to staff once to send. An invite expires after 30
days, and a new one for the same Traveller revokes the old. Minors are refused. `channel` records how
the link went out; sending through sent.dm (SMS or WhatsApp, also in bulk) is a later delivery step
on the same records.

**Claiming.** A signed-in Account Holder sends the token (`customerApp:claimInvite`). It creates a
Journey Entitlement with `role: "traveller"`, `source: "trip_invite"`, and the new fields
`jobCardId` and `travellerId` naming the invited Traveller row. The invite is then used; the same
account claiming again gets the same trip, any other account is refused with the same error as a
bad token. One account holds at most one Traveller per trip, and a Traveller is held by at most one
account. An operator grant the account already holds on the same trip gains the Traveller link and
keeps its role. Holding the token is the proof: it went to a contact Operations verified, and the
invite never matches on email or phone ([ADR 0013](0013-explicit-customer-journey-entitlements.md)).

**Guardian consent.** While accepting, the guardian may tick consent for each minor that names their
Traveller row in either guardian slot. Each tick, and each later grant or withdrawal from the trip
page (`customerApp:setParentalConsent`), appends one `customerParentalConsents` row: minor, guardian
Traveller, account, entitlement, consent text version (`2026-11-07`) and server time, with
`source: "guardian_invite"`. It never writes `travellers.parentalConsent`, which is the Operations
mark; neither overwrites the other.

**Reads.** `customerApp:listMyTrips` and `customerApp:getMyTrip` start from the caller's own active
entitlements and return a trip only while its Job Card's app pilot is on. A trip is addressed by its
entitlement id, never a Job Card id. A traveller sees their own Traveller row and the minors who name
it as a guardian: names, group code, status words for passport, visa and ticket (never files,
numbers or dates), the tour managers assigned to the whole trip or to their own group (name, phone,
reporting note), the frozen itinerary, and the field announcements sent to them or their minors.
No prices are returned. An organizer grant without a Traveller sees the trip, contacts, itinerary
and all announcements, and no one's documents. Past trips stay listed for as long as the
entitlement and the pilot do.

**Destination photos.** Each trip summary carries `cover`: a website path to a photo of its
destination and the photo's BlurHash, matched by a whole word in the destination
(`convex/lib/customerAppCovers.ts`), or null. The photos are Citius's own website images; ten
existing place photos are also published under `public/images/destinations/` so they have stable
URLs. Only photos about 1,000 px tall or more are listed, because the app crops them to portrait
on 3x screens; Goa, Vietnam and Mussoorie need larger photos first. The app shows the BlurHash at
once, then a 96 px preview, then the photo at the screen's pixel width through the website's image
optimizer at the site's own quality.

**Sign-in.** Better Auth's email-link plugin (`magicLink`), links valid once for 10 minutes and
stored hashed. The email points to the website's `/app/sign-in` page, which passes the token in the
URL fragment to `citius://sign-in?token=…`; the app calls `/magic-link/verify` itself, so the session
lands in the app's SecureStore and no session cookie travels in a URL. Staff emails get no link (the
response is the same, so the form does not reveal them). Delivery shares the verification email's
ledger purpose and Live Feature Control. SMS sign-in is a seam in the app until sent.dm and DLT
registration exist; it will use Better Auth's `phoneNumber` plugin.

## Consequences

- Schema changes are additive: two optional entitlement fields, one index, a new `source` literal,
  and two tables. No backfill.
- Revoking a traveller's app access (`customerTripInvites:revokeTravellerAccess`) ends the
  entitlement, not the account. The owner's rule that access is never fully removed is kept by
  Operations practice: the control exists for wrong-person claims.
- Until Universal Links and App Links are set up, the `citius://` hand-off can be claimed by another
  app that registers the same scheme on the phone. The token is single-use and short-lived, and the
  website page never holds a session, which bounds the exposure; Universal Links remove it.
- Account deletion ([ADR 0019](0019-self-service-customer-account-deletion.md), separate PR) must also remove the
  account's `customerTripInvites.claimedByAuthUserId` link and decide how long
  `customerParentalConsents` rows are kept as consent evidence.
