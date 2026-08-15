# Customer attribution source-provenance backfill

> Status: not an Account authorization migration. The earlier email-attribution cutover was
> superseded by [ADR 0013](../adr/0013-explicit-customer-journey-entitlements.md).

Customer Travel Account access must not be inferred from Client, inbound-intent, Query, or
Confirmed Offer email fields. Confirmed-trip reads use only an explicit
`customerJourneyEntitlements.by_authUserId_createdAt` lookup and cursor pagination. The enabled
`clients.by_emailNormalized`, `inboundQueryIntents.by_contactEmailNormalized`, and
`queries.by_clientId` indexes were backfilled and verified on the dedicated Preview target for
source-provenance reporting. They are not Account reader dependencies and do not authorize Account
journeys.

Use [the auth identity ownership migration](auth-identity-ownership.md) for the authoritative
issuer-qualified identity and Journey Entitlement sequence. It quarantines ambiguity instead of
manufacturing ownership from matching email addresses.

## Limited historical purpose

`crm/customerAttributionMigration:backfillCustomerAttribution` remains available only to normalize
stored source provenance when a separate product or reporting requirement explicitly needs those
relationships. This runbook is not authority to execute it on a deployment, and it must never be
used to grant Account visibility.

If that separate source-provenance repair is approved:

1. Identify and announce the exact Development, Preview, or Production Convex deployment.
2. Verify each enabled index is ready on the exact target before activating a reader that explicitly
   depends on it. A Preview verification is not Production evidence.
3. Run each stage first with `dryRun: true`, then with `dryRun: false`, following
   `continueCursor` until `isDone` is true: `clients`, `intents`, `queries`, then `offers`.
4. Repeat the dry run and require `changed: 0`.
5. Record counts and target identity without storing customer emails in release evidence.

Example for an already identified non-production target:

```sh
bunx convex run crm/customerAttributionMigration:backfillCustomerAttribution \
  '{"stage":"clients","dryRun":true}'
```

Production requires separate approval and exact target classification. Rows without authoritative
identity links remain inaccessible; an email match is never sufficient remediation.
