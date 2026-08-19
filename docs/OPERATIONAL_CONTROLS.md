# Production operational controls

The Staff Workspace Settings surface exposes audited operational controls only to the exact
`Admin` role. Directors retain the rest of Settings but neither mount the browser query nor receive
Convex authority for the control plane.

## Two control modes

- **Global** changes normal traffic for every visitor. It requires an audit reason, uses optimistic
  revision checks, can reset automatically after 30 minutes, 2 hours, or 24 hours, and can be reset
  to the catalog behavior.
- **30-minute test** issues a signed capability retained only in the Admin's current tab. It affects
  only a synthetic request that presents the matching capability and scope; normal visitor traffic
  is unchanged. Revocation and expiry are authoritative in Convex. This release exposes that mode
  only for inbound contact, the one surface with a reviewed synthetic execution seam.

The inbound-contact recipe starts with CRM intake enabled and all bell/email effects disabled. Its
test button submits the normal protected Website enquiry shape, creates a visibly marked synthetic
Inbound Query Intent, and reports the independent CRM intake, Sales bell, Sales email, and
`info@citius.in` mailbox-copy dispositions. Turnstile remains required when configured. Synthetic
rows and effect receipts are durable evidence and cannot be converted into ordinary customer data.

## Catalog and safe state

The catalog covers inbound CRM intake and contact effects, CRM bell/email workflows,
authentication email, Concierge, Journey Planner, Razorpay order creation, document preview worker
preparation, and scheduled jobs. All eleven cron registrations pass through the shared scheduled-job
action gate without changing their schedules or arguments.

Before the one-way activation marker exists, ordinary traffic follows each catalog entry's standard
behavior, so deploying the schema and functions cannot silently switch off existing features.
Admins can prepare explicit states during this compatibility phase, but those prepared states affect
only signed synthetic tests until activation. Activation is one Convex transaction: it rejects
duplicate, expired, or safe-default rows, preserves valid prepared rows, initializes every untouched
available control to an explicit default, records the activation marker, and writes one audit event.

After activation, missing, expired, duplicate, or corrupt persisted state fails closed, except that
durable inbound CRM intake stays enabled so a malformed toggle cannot silently discard a lead.
Dependencies are enforced at the effect boundary, so enabling an inbound email cannot bypass a
disabled CRM workflow-email control. Activation is irreversible; later behavior changes use audited
control mutations and rollbacks, never deletion of the activation marker.

Global state changes never cancel already queued email or reverse provider activity already in
flight. New Razorpay orders are blocked when payments are paused, while verification and webhooks
continue so an existing payment can settle safely.

## Configuration and activation

Store the same high-entropy `OPERATIONAL_CONTROL_GATEWAY_SECRET` independently in Next.js and
Convex. Store `OPERATIONAL_CONTROL_TEST_SIGNING_SECRET` only in Convex and use at least 32 bytes.
Neither value is browser-exposed or returned by an Admin query. The signed test token is returned
once to the authenticated Admin mutation and must not be logged or persisted by the UI.

Deploying source is not activation or promotion. For each named Preview or Production target:

1. install the target's server secrets without printing values;
2. stage the Convex schema/functions and matching Next.js revision at a unique Vercel Production URL
   without assigning public domains;
3. establish and review the intended explicit control states;
4. run a signed inbound synthetic test with email disabled and confirm a synthetic CRM row plus
   suppressed email receipts;
5. activate the control plane atomically and verify the `plane_activated` audit plus initialized keys;
6. run bounded Concierge and payment checks only after their controls are enabled;
7. record revision, target, operator, audit IDs, and pass/fail without recording capabilities;
8. obtain fresh Production approval, then promote the staged deployment to the public domains.

If exact-Admin authorization, state preparation, signed proof, activation, or post-activation checks
fail, stop. Never promote a staged deployment merely to obtain access for verification.

Production configuration, state activation, deployment, and live proof require fresh Production
authority. Local tests and a Preview result do not imply Production state.
