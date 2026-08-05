# Firewall and WAF baseline runbook

This is the auditable baseline for the Citius web deployment. It describes the controls that
must be enabled and the evidence that must be retained; it does not claim that a provider has
already enabled a rule. The release owner records the provider, rule IDs, date, and deployment
identifier in the release evidence bundle after each change.

## Ownership and escalation

| Responsibility | Escalate to | Required response |
| --- | --- | --- |
| First triage and evidence capture | Engineering on-call | Preserve request IDs and provider event IDs; do not delete logs |
| Customer-data or authentication exposure | Director + Engineering owner | Contain access, rotate affected credentials, and start the security disclosure process |
| Payment/webhook abuse | Accounts owner + Engineering owner | Disable the affected integration path without acknowledging untrusted events |
| Provider outage or WAF false positive | Deployment owner + provider support | Record the provider case ID and a temporary, least-privilege exception |

The named people and current contact channels are deployment-owned configuration. Do not put a
personal phone number, customer document, secret, or bearer token in this repository.

## Baseline rules

Record the exact provider rule ID and observed state for each item:

1. Redirect HTTP to HTTPS and enable HSTS only after all subdomains are HTTPS-ready.
2. Keep the WAF managed ruleset enabled at its current supported version. Start new rules in
   log/challenge mode, review false positives, then promote to block mode with a change record.
3. Rate-limit authentication, password reset, public enquiry/contact, invite-code, payment
   webhook, revalidation, and file-download routes. Limits are per identity where authenticated
   and per privacy-safe source key at the edge; never log raw cookies or request bodies.
4. Challenge or deny obvious automation on public intake. Never bypass application validation,
   authorization, payment signature checks, or the Convex fail-closed policy because a request
   passed the WAF.
5. Deny path traversal, encoded separator abuse, unexpected methods, invalid content lengths,
   and active HTML/SVG uploads at the edge where the provider supports those predicates.
6. Permit only the required origins, methods, and webhook paths. Keep CORS narrow and do not
   treat `Origin`, `Referer`, or a client-supplied role as authorization.
7. Ensure blocked events include a provider event ID, rule ID, timestamp, route, action, and a
   redacted source key. Do not retain passport/visa contents, authorization headers, session
   cookies, or payment secrets in WAF logs.

## Release/change evidence

For every WAF or firewall change, attach:

- provider and environment (preview/staging/production);
- deployment commit and deployment ID;
- rule name/ID, old state, new state, mode, and rationale;
- test request IDs proving an allowed request still works and a blocked request is denied;
- false-positive review for authentication, enquiry, webhook, and file routes; and
- approver, timestamp, rollback step, and provider case ID when applicable.

No rule is “complete” from a code diff alone. The deployment owner must capture the provider
dashboard/API response or an exported configuration snapshot in the release evidence store.

## Abuse or blocked-request response

1. Record the first and last occurrence, provider event IDs, rule IDs, route, deployment ID,
   request correlation IDs, and the redacted source key. Preserve the original timezone.
2. Check application logs and Convex activity/auth/payment records for the same correlation IDs.
   Search for authorization failures, repeated invite attempts, password-reset bursts, webhook
   signature failures, and unusual file-download volume.
3. Classify the event as false positive, nuisance abuse, suspected account compromise, customer
   data exposure, or payment abuse. Do not copy request bodies into chat or tickets.
4. For suspected compromise, revoke sessions or affected credentials, disable the narrowest
   route/integration, and notify the Director and Engineering owner. Preserve evidence before
   changing the rule when safe.
5. For a false positive, prefer a narrowly scoped exception (route, method, or trusted provider
   path) with an expiry and an owner. Never allowlist a whole country, user-agent, or broad IP
   range without documented approval.
6. Retest the smallest safe request, record the outcome, and close the incident with impact,
   containment, remediation, and follow-up actions. Follow [`SECURITY.md`](../SECURITY.md) if a
   vulnerability or customer-data exposure is suspected.

## Review cadence

The deployment owner reviews the baseline before each production release and after any provider,
authentication, upload, webhook, or public-intake change. The Director reviews open exceptions
monthly. Expired exceptions are removed rather than silently renewed.
