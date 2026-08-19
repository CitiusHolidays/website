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
preparation, and scheduled jobs. Scheduled jobs are visible as unavailable because current cron
registrations do not share one reversible execution seam.

Missing state follows each catalog entry's standard behavior, so introducing the control plane does
not switch off existing features on first deployment. Expired, duplicate, or corrupt persisted state
fails closed, except that durable inbound CRM intake stays enabled so a malformed toggle cannot
silently discard a lead. Dependencies are enforced at the effect boundary, so enabling an inbound
email cannot bypass a disabled CRM workflow-email control.

Global state changes never cancel already queued email or reverse provider activity already in
flight. New Razorpay orders are blocked when payments are paused, while verification and webhooks
continue so an existing payment can settle safely.

## Configuration and activation

Store the same high-entropy `OPERATIONAL_CONTROL_GATEWAY_SECRET` independently in Next.js and
Convex. Store `OPERATIONAL_CONTROL_TEST_SIGNING_SECRET` only in Convex and use at least 32 bytes.
Neither value is browser-exposed or returned by an Admin query. The signed test token is returned
once to the authenticated Admin mutation and must not be logged or persisted by the UI.

Deploying source is not activation. For each named Preview or Production target:

1. install the target's server secrets without printing values;
2. deploy the Convex schema/functions and matching Next.js revision;
3. establish and review the intended explicit control states;
4. run a signed inbound synthetic test with email disabled and confirm a synthetic CRM row plus
   suppressed email receipts;
5. run bounded Concierge and payment checks only after their controls are enabled;
6. record revision, target, operator, audit IDs, and pass/fail without recording capabilities.

Production configuration, state activation, deployment, and live proof require fresh Production
authority. Local tests and a Preview result do not imply Production state.
