# Passenger import receipt positions

## Contract

Passenger import operation receipts claim a server-computed prepared-content identity at each
`(operationId, batchIndex)` before any Traveller-family write. Exact-content retries may reuse a
slot. Different content at a claimed slot fails before row processing or operation aggregate writes.

The schema transition is widening:

- operation-batch rows add optional `batchIndex`, `rowCount`, and `status` fields;
- operations add optional `terminalBatches` coverage;
- `by_operationId_batchIndex` provides the canonical slot lookup;
- a bounded per-operation fallback adopts legacy rows whose server batch ID already contains the
  position, so no eager data rewrite is required.

Receipts contain IDs, digests, counts, classifications, and room summaries only. They do not store
raw passenger rows, passport values, or encrypted passport payloads.

## Local verification

These checks are target-neutral:

```bash
bun test convex/crm/importCommit.test.ts convex/crm/passengerImportCommit.test.ts convex/crm/importWorkerPolicy.test.ts
bun run convex:typecheck
bun run typecheck
```

The focused tests force failures across Traveller create/patch, Visa, Passport, PNR/Vendor/Ticket,
and metric scheduling; exercise exact and conflicting slot claims; verify out-of-order coverage and
legacy adoption; and prove a retry does not duplicate fanout rows or PNR issued seats.

## Deployment verification

Run this section only against an explicitly identified non-production Convex deployment. Confirm
the deployment identity before any command. Deploy the widening schema/functions, wait for
`by_operationId_batchIndex` to become ready, then run a synthetic authenticated import with:

1. two positions delivered out of order;
2. an exact replay of a completed position;
3. a different-content replay rejected before row writes;
4. a forced retryable row followed by a successful retry; and
5. cleanup proving no synthetic Traveller-family or receipt rows remain.

Production rollout and production data verification are a separate, explicitly approved release
step. This source change does not authorize either one.
