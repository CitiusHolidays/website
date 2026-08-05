# Security policy

Citius Holidays handles customer identity, travel, payment, and staff CRM data. Treat a
suspected exposure as confidential and report it before discussing it in a public issue,
social post, or customer channel.

## Private disclosure

The preferred intake is a private GitHub Security Advisory for this repository: open the
repository's **Security → Advisories → Report a vulnerability** flow. If that flow is not
available to you, ask the Citius director or engineering owner for the current confidential
security contact. Do not send passwords, API keys, passport/visa documents, or full request
cookies in a report; redact them and include only the minimum reproduction data needed to
validate the issue.

Please include:

- affected route, component, or deployment and the first known version;
- a concise impact statement and realistic attack preconditions;
- reproduction steps or a minimal proof of concept that does not access other people's data;
- timestamps, correlation/request IDs, and redacted logs when available; and
- whether the report is already known to a customer or provider.

We will acknowledge a report within two business days, confirm severity and a mitigation owner
as soon as the report is reproduced, and coordinate disclosure timing with the reporter. We may
ask for a safe retest after a fix. Please do not exfiltrate or retain customer documents while
proving an issue; stop after demonstrating authorization failure or the smallest harmless
payload.

## Scope

In scope are this repository, its deployed Citius web application, Convex functions and data
access rules, authentication/session boundaries, CRM and account APIs, payment webhooks, and
production configuration that is maintained by Citius. Third-party providers (Vercel, Convex,
Resend, Razorpay, Sanity, and identity providers) are in scope only for a Citius integration
mistake; report a provider-native vulnerability through that provider's own program as well.

Out of scope are denial-of-service testing, social engineering, physical attacks, spam, bulk
account creation, and access to real customer documents beyond what is needed to prove a bug.
Automated scanning must be limited to a test account and a low request rate. Never test against
production payment capture or send messages to customers.

## Supported releases and evidence

The release gate must retain the relevant test output, dependency audit, secret/policy scan,
deployment identifier, environment preflight, and WAF evidence for each production release.
Bootstrap Admin access is break-glass only and requires a future
`PORTAL_BOOTSTRAP_ADMINS_EXPIRES_AT`; staff provisioning records the actor and expiry in the
CRM activity log. See [`docs/SECURITY_WAF_RUNBOOK.md`](docs/SECURITY_WAF_RUNBOOK.md) for the
operator baseline and incident evidence checklist.

If a public disclosure appears before a private report can be filed, do not include exploit
details or sensitive data. Point maintainers to this policy and request a private channel.
