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
days, and a new one for the same Traveller revokes the old. Only a Traveller recorded as an adult
(`isMinor: false`) can be invited, previewed or claimed: minors are refused, and so is a Traveller
whose age is not recorded, because an unset flag means "not recorded", never "adult"
([ADR 0018](0018-link-minors-to-a-guardian-traveller.md)); the panel says why such a row has no
tick box. A Tour Manager-only grant sees and invites only their own groups. `channel` records how
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
it as a guardian: their own name, group code and status words for passport, visa and ticket (never
files, numbers or dates; passport status is reduced to "Received" or "Pending"), the minors' names
only, the tour managers assigned to the whole trip or to their own group (name, phone, reporting
note), the frozen itinerary, and the field announcements sent to them or their minors. No prices
are returned. Nobody sees another traveller's documents or messages: an entitlement without a
Traveller row sees the trip, itinerary and trip-wide tour managers; an organizer also sees the
announcements the tour manager sent to the whole trip, and nothing sent to a group or a few people.
"Whole trip" is the sender's explicit choice (`fieldSync:recordAnnouncement` with
`audience: "trip"`), kept only when it went to every travelling traveller from a whole-Job-Card
grant, never inferred from the recipient list: a message to the only traveller on a trip is still
personal when others are added later. Until Citius Connect sends that choice, organizers see no
announcements.
A Traveller later marked a minor, or whose age record is cleared, loses the app view. A claimed
invite is shown only in the app, behind the pilot; it does not add a packet to the website
`/account` page. On that page a traveller-role packet carries no CRM facts (query code, lead
source, preparation status, ticketing scope, group size). Past trips stay listed for as long as
the entitlement and the pilot do.

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
lands in the app's SecureStore and no session cookie travels in a URL. Staff emails, including the
bootstrap Admin mailboxes, get no link (the response is the same, so the form does not reveal
them). Each link is bound to the phone that asked for it: the app keeps a random secret, sends its
SHA-256 digest with the request (`metadata.deviceDigest`) and the secret itself in the
`x-citius-sign-in-device` header when it verifies; a link forwarded to another phone signs nobody
in, so nobody can be signed in to someone else's account and then claim their own invite into it.
Before accepting, the app shows which account the trip will be added to. A Convex HTTP action
sees no client IP it can trust, so links are limited on rows of digests
(`customerAppSignInLinks`), bounding what an inbox can receive rather than who asks:
five an hour per inbox, after folding aliases that reach one inbox (case, `+tags`, Gmail dots and
googlemail.com, Yahoo `-` disposable addresses); thirty an hour per domain that is not a large
shared provider, which bounds catch-all domains and subdomain addressing that no folding can see
(a company group signing in all at once may meet it and retry within the hour). Both answer like a
sent link. The ten-an-hour phone limit counts a digest the caller chooses, so it only slows a
looping app ("try again later"); it is not a security control. Past 300 links an hour across the
app, addresses that already have a login are still served, a new address is refused silently and
an alarm is logged (`customer_app.sign_in_overall_ceiling`): a flood can delay first sign-ins, never
lock out existing customers, and the silent answer reveals nothing about which addresses exist.
Every refused request also deletes the link Better Auth stored before the limit was checked, which
holds the address. The daily job `jobs.purge_customer_app_sign_in_links`
deletes requests older than a day with each link's Better Auth verification row, which holds the
address; account deletion deletes the account's requests and those rows at once, expired or not. The `/app/invite` and `/app/sign-in` pages run no page
analytics. Delivery shares the verification email's
ledger purpose and Live Feature Control. SMS sign-in is a seam in the app until sent.dm and DLT
registration exist; it will use Better Auth's `phoneNumber` plugin.

## Consequences

- Schema changes are additive: two optional entitlement fields, one index, a new `source` literal,
  and three tables. No backfill.
- Better Auth's own per-IP rate limit still keeps its counters in memory. Moving it to the
  database needs a `rateLimit` table in the Better Auth component and adapter support for atomic
  increments, which is not verified yet; the per-address limit above does not depend on it.
- Revoking a traveller's app access (`customerTripInvites:revokeTravellerAccess`) ends the
  entitlement, not the account. An operator grant that a claim only linked to the Traveller keeps
  its access and loses the Traveller link. The owner's rule that access is never fully removed is kept by
  Operations practice: the control exists for wrong-person claims.
- Until Universal Links and App Links are set up, the `citius://` hand-off can be claimed by another
  app that registers the same scheme on the phone. The token is single-use and short-lived, and the
  website page never holds a session, which bounds the exposure; Universal Links remove it.
- Consent records are kept exactly as long as the trip records they cover (owner decision, 7 Nov
  2026). The traveller anonymisation job (`jobs.anonymise_past_travellers`, three years after the
  trip) deletes the consents recorded for a minor and the app invites issued to a traveller when it
  anonymises that Traveller. Account deletion
  ([ADR 0019](0019-self-service-customer-account-deletion.md)) deletes the consents the account
  recorded, revokes its trip entitlements and writes the deletion tombstone into the invite it
  claimed (`claimedByAuthUserId`), which stays as Operations' record until the anonymisation job.
