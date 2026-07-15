# Notification email delivery

CRM notification email is queued from the same transaction that creates its in-app notification rows. The first inserted notification ID is the stable event identity passed to the scheduled action. Bell rows continue to target exact roles, users, or staff IDs; email recipients continue to use the separate role-expansion and staff-email rules.

## Idempotency

Each provider request uses an idempotency key shaped as:

```text
crm-notification/<notification-id>/<recipient-sha256-prefix>
```

The recipient is normalized and hashed before it enters the key. Titles, bodies, record details, email addresses, and secrets are not included. Every retry for a recipient—including 429, provider 5xx, ambiguous network failure, or scheduled-action replay—reuses the same key. Different recipients for the same event receive distinct keys. Sequential recipient staggering and retry backoff remain in place.

Resend currently retains idempotency keys for a provider-defined window. Scheduler replays must therefore preserve the original event ID and must never replace it with a retry timestamp.

## Environment transition

`RESEND_API_KEY` is canonical in both Next.js and Convex environments.

`RESEND_KEY` is a temporary legacy Convex fallback through **30 September 2026**. When the fallback is used, the action logs only the legacy variable name and migration deadline; it never logs the value. Remove the fallback after every environment has been checked and migrated.

Operator checklist:

1. Set `RESEND_API_KEY` in the Convex deployment environment.
2. Trigger one non-production CRM notification and confirm delivery.
3. Remove `RESEND_KEY` from that environment.
4. Repeat for preview and production before the sunset date.
5. Remove the fallback constants and tests after the migration is complete.
