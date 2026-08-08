# Customer attribution backfill

This rollout starts with the new lookup indexes marked `staged: true`. Deploy that staged schema to
the identified target first and wait for Convex to finish backfilling the indexes. Then remove the
`staged` option, deploy the active indexes, and only then deploy reads that depend on those indexes.
The current customer read deliberately scans each relevant table once until that activation step
is complete, so a partially backfilled index cannot silently hide a customer's confirmed trips.

Run the row backfill only after the schema and functions containing
`customerAttributionMigration` are deployed to the identified target. Local verification and code
generation do not prove that a deployment's stored rows are migrated.

For each stage below, first run with `dryRun: true`. Then run with `dryRun: false`, passing the
returned `continueCursor` until `isDone` is true. Repeat the dry run and require `changed: 0`.

Stages must run in this order:

1. `clients`
2. `intents`
3. `queries`
4. `offers`

Example for the identified development target:

```sh
bunx convex run crm/customerAttributionMigration:backfillCustomerAttribution \
  '{"stage":"clients","dryRun":true}'
```

Use `--prod` only after explicitly identifying and announcing the production target. This migration
does not manufacture missing customer email addresses. Rows without a previously stored client or
inbound-intent email remain unavailable to email-scoped Customer Account reads and require a
separate, audited identity-reconciliation decision.
