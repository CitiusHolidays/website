# Notification email delivery

CRM notification email is queued from the same transaction that creates its in-app notification
rows. `publishWorkflowNotification` requires separate, explicit bell and email targets. The first
inserted notification ID is the stable event identity passed to the scheduled action. Bell rows
target exact roles, users, or staff IDs; role email targets use portal roles plus additive
**Additional email alert roles**, while direct staff targets resolve only the selected staff IDs.

![Notification delivery and replay flow](../diagrams/notification-delivery-replay.svg)

The editable source is `diagrams/notification-delivery-replay.mmd`; the rendered SVG/PNG and
Excalidraw scene are kept beside it.

## Idempotency

Each provider request uses an idempotency key shaped as:

```text
crm-notification/<notification-id>/<recipient-sha256-prefix>
```

The recipient is normalized and hashed before it enters the key. Titles, bodies, record details, email addresses, and secrets are not included. Every retry for a recipient—including 429, provider 5xx, ambiguous network failure, or scheduled-action replay—reuses the same key. Different recipients for the same event receive distinct keys. Sequential recipient staggering and retry backoff remain in place.

Resend currently retains idempotency keys for a provider-defined window. Scheduler replays must therefore preserve the original event ID and must never replace it with a retry timestamp.

## Delivery ledger

Each recipient outcome is recorded in `notificationEmailDeliveries` with one of these monotonic
statuses: `queued`, `sending`, `retrying`, `sent`, `skipped`, or `exhausted`. A later scheduler replay
cannot move a `sent` row back to `queued` or `sending`, and ledger writes retry with bounded
backoff if the recording mutation is temporarily unavailable.

The Activity delivery summary is guarded by `view:emailDeliveryStatus` and returns grouped counts
plus a permitted notification link. It never returns raw recipient addresses, message content, or
provider response bodies. Department heads, Admin, Directors, and Director Cement receive this
oversight permission; ordinary department roles do not.

## Environment transition

`RESEND_API_KEY` is canonical in both Next.js and Convex environments.

`RESEND_KEY` is a temporary legacy fallback for Convex notifications and the Next.js contact form through **30 September 2026**. When the fallback is used, the action logs only the legacy variable name and migration deadline; it never logs the value. Remove the fallback after every environment has been checked and migrated.

Operator checklist:

1. Set `RESEND_API_KEY` in the Convex deployment environment.
2. Trigger one non-production CRM notification and confirm delivery.
3. Remove `RESEND_KEY` from that environment.
4. Repeat for preview and production before the sunset date.
5. Remove the fallback constants and tests after the migration is complete.
