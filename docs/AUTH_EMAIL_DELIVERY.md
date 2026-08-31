# Auth email delivery

Verification and password-reset email use a dedicated, privacy-safe delivery receipt. This is a
different authority from CRM workflow email and is not exposed through Activity.

## Delivery contract

- `convex/lib/authEmailDelivery.ts` derives a SHA-256 correlation digest from the purpose and an
  opaque per-request correlation secret. The provider idempotency key combines that digest with a
  one-way recipient digest; retries for one request therefore reuse one provider identity.
- Retryable Resend 429, 5xx, and ambiguous network outcomes use the same bounded four-attempt,
  550-ms-minimum pacing program as CRM email. A token-expiry check runs before every provider
  attempt. There is no delayed retry after the one-hour Better Auth token lifetime.
- `convex/authEmailDeliveries.ts` records only purpose, correlation digest, attempts, safe failure
  category, optional provider status, expiry, timestamps, and terminal status. It never receives or
  stores recipient email, token, URL, subject, HTML, text, cookie, JWT, password, or provider key.
- Better Auth callbacks catch delivery failure and return no provider detail. The public
  request-password-reset response therefore remains Better Auth's generic response for existing
  and nonexistent accounts.
- Internal staff/account-linking flows report `sent: true` only after reading a matching durable
  `sent` receipt. A generic Better Auth API success is not delivery evidence.

## Safe outcomes

Statuses are `queued`, `sending`, `retrying`, `sent`, `skipped`, and `exhausted`. Safe failure codes
include `provider_not_configured`, `rate_limited`, `provider_unavailable`, `network_error`,
`provider_rejected`, `provider_error`, and `token_expired`.

Exact Admins can inspect **Authentication email health** in Settings → Runtime health. The public
projection is fixed to the selected target identity, source revision, and preceding 24-hour window,
and reads at most 50 recent outcomes. It reports purpose/status counts plus a bounded intent/effect
timeline. When the bound is reached it labels coverage partial. The projection never returns
correlation or recipient digests, raw recipients, tokens, URLs, subjects, bodies, provider response
bodies, or provider keys; provider status is reduced to a safe class.

Recovery is actionable but stays at the owning auth workflow. An unexpired failure may direct an
Admin to review the exact target's control or Resend configuration and then ask the user to request
a fresh link. An expired verification, password-reset, or staff-setup token is never resent; the
user must start a fresh owning auth flow. Runtime receipts do not prove inbox delivery or provider
health.

## Verification boundary

Target-neutral tests cover stable idempotency, 429/5xx retry, permanent rejection, expiry,
duplicate callbacks, exact-Admin and revocation checks, bounded target/window projection,
privacy-safe storage/output, and the rule that generic API success is not a sent result. Real inbox
delivery, a Google-only account password reset, subsequent credential login, and Guest/Staff browser
recovery require a dedicated non-production Vercel + Convex Preview with Preview-only credentials.
They are deployment evidence, not local source evidence.
