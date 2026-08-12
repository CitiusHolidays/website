# Convex return contracts

This repository is rolling out explicit Convex `returns` validators so public API
outputs stay typed, reviewable, and testable without changing handler behavior or
permissions.

## Pilot APIs

The first rollout covers the highest-traffic portal reads and the durable import/export operation
boundaries:

| API | Module | Return validator |
| --- | --- | --- |
| `crm.queries.listPage` | `convex/crm/queries.ts` | `queryListPageResultValidator` |
| `crm.queries.getListRow` | `convex/crm/queries.ts` | `queryGetListRowResultValidator` |
| `crm.queries.getDetail` | `convex/crm/queries.ts` | `queryGetListRowResultValidator` |
| `crm.jobCards.listPage` | `convex/crm/jobCards.ts` | `jobCardListPageResultValidator` |
| `crm.jobCards.getListRow` | `convex/crm/jobCards.ts` | `jobCardGetListRowResultValidator` |
| `crm.jobCards.getDetail` | `convex/crm/jobCards.ts` | `jobCardGetListRowResultValidator` |
| `crm.dashboard.getPortalSummary` | `convex/crm/dashboard.ts` | `portalSummaryResultValidator` |

Shared row and pagination validators live in `convex/crm/returnContracts.ts`.
Contract assertions for tests live in `convex/crm/validateReturnContract.ts`.

## Pattern by function kind

### Queries

```ts
import { paginationResultValidator } from "convex/server";
import { query, mutation, action } from "../_generated/server";
import { v } from "convex/values";
import { queryListPageResultValidator } from "./returnContracts";

export const listPage = query({
  args: { /* existing args */ },
  returns: queryListPageResultValidator,
  handler: handleQueryListPage,
});
```

- Reuse the same row validator for `listPage` and `getListRow`.
- Focused modal and deep-link reads use `getDetail`; its bounded presenter currently shares the
  same detail-row validator as `getListRow`.
- Register `returns: v.union(rowValidator, v.null())` when a missing or forbidden
  record is represented as `null` (not `undefined`).

### Mutations

```ts
export const create = mutation({
  args: { name: v.string() },
  returns: v.object({ id: v.id("entities") }),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("entities", { name: args.name });
    return { id };
  },
});
```

- Return `v.null()` when the handler intentionally returns nothing.
- Prefer precise object validators over `v.any()` for IDs and status enums.

### Actions

```ts
export const importRows = action({
  args: { batchId: v.string() },
  returns: v.object({
    imported: v.number(),
    skipped: v.number(),
  }),
  handler: async (_ctx, args) => {
    return { imported: 0, skipped: 0 };
  },
});
```

- Actions follow the same `returns` registration as queries and mutations.
- Cross-runtime orchestration results should still use explicit unions/objects.

## Nullable vs optional fields

Convex stores `null`; clients never receive `undefined` from function returns.

| Storage / API intent | Validator |
| --- | --- |
| Field always present, may be empty | `v.string()`, `v.number()`, etc. |
| Field may be absent on input args | `v.optional(v.string())` in `args` only |
| Field present in output but empty | `v.union(v.string(), v.null())` or `v.literal("")` when the presenter normalizes to empty string |
| Record not found | top-level `v.union(rowValidator, v.null())` |

Examples in the pilot contracts:

- Query `confirmedAt` / `submittedToContractingAt`: `v.union(v.string(), v.null())`
- Job card `proposalId` / `queryId`: `v.union(v.null(), v.id("proposals"))`
- Dashboard `aggregateCoverage.errorSummary`: `v.union(v.null(), v.string())`

## Paginated list returns

Use Convex's `paginationResultValidator(itemValidator)` from `convex/server`:

```ts
export const queryListPageResultValidator = paginationResultValidator(queryListRowValidator);
```

A paginated page includes:

- `page`: array of authorized row shapes
- `continueCursor`: string cursor for the next request
- `isDone`: boolean end-of-list marker
- optional `splitCursor` and `pageStatus` when Convex recommends splitting a page

List handlers should keep using `boundedPaginationOptions()` and
`applyCrmCursorFilters()`; return contracts document the wire shape only.

## Dynamic structured fields

When schema storage is intentionally flexible, define an explicit compatible union
instead of `v.any()`:

- `paymentTermsOutputValidator`: `null` or `{ label, minAdvancePercent, maxAdvancePercent }`
- `preDepartureChecklistOutputValidator`: `null` or an array of checklist item
  objects with optional legacy keys (`done`, `label`, `owner`, `completed`, etc.)

## Search readiness and metric aggregate coverage

Pilot list row validators describe the authorized record shape returned after
visibility filtering. Search gating (`assertListSearchReady`) remains in handlers;
malformed search responses are still rejected at the args/handler layer via
`SEARCH_INDEX_PREPARING`.

Dashboard responses include `aggregateCoverage`, which mirrors
`summarizeMetricReadiness()`:

- `complete`, `state`, `generation`, `version`
- `completedSources` for reconciled metric source tables
- nullable `lastCompletedAt` / `updatedAt` timestamps
- `detailRowLimit` documenting the bounded detail scan used for drill-down slices

Contract tests cover both empty summaries and aggregate-complete summaries.

## Long-running operation returns

Spreadsheet work is represented as a durable operation instead of one unbounded request. The
validators in `convex/crm/importReturnContracts.ts` cover:

- passenger import progress (`operationId`, batch counts, row totals, retryable/terminal error
  summary, remaining work, and room summary);
- passenger export state (`running`, `completed`, `failed`, or `expired`) and its private download
  result; and
- flight import totals for created and updated groups and segments.

Operation return contracts are intentionally separate from the row validators. They let the portal
show partial or retryable work without treating a partial batch as a completed workbook.

Passenger import receipts use `(operationId, batchIndex)` as the slot boundary. Receipt rows store
only server batch IDs, positions, counts, safe summaries, and error classifications—never source
passenger or passport rows. Legacy receipts are adopted from their existing server batch ID when an
exact retry reaches that slot.

## Contract tests

`convex/crm/returnContracts.test.ts` validates representative:

1. empty list/page payloads
2. partial rows with defaulted presenter fields
3. paginated pages with cursor metadata
4. fully populated rows and dashboard summaries
5. malformed payloads that must be rejected

Use `assertMatchesReturnContract(validator, value)` from
`convex/crm/validateReturnContract.ts` in tests. Keep fixture construction aligned
with `publicQuery()`, `publicJobCard()`, and existing dashboard helpers so
contracts track presenter output rather than raw table documents.

`convex/publicReturnInventory.test.ts` discovers both direct registrations and the reviewed
`mutationWithAccess` factory through the TypeScript AST. An exported registration factory that is not
explicitly allowlisted fails closed. The same test compares internal registrations without `returns`
against `config/release/convex-internal-return-gaps.txt`: additions fail immediately, and a validator
change must remove its named exception. The current staged baseline is 62 after validating the 14
import/export, notification-ledger, and proposal-projection functions introduced in `7fa38a0`.

The explicit-table database API migration follows the same no-new-debt rule in
`convex/explicitTableApiInventory.test.ts`. Its file-and-method baseline lives in
`config/release/convex-explicit-table-gaps.txt`; each entry is owned by #144 and is removed only when
the source call and its direct database mocks use the exact table-name overload. The first typed
finance/ticketing tranche reduced the baseline from 595 to 588 ID-only calls.

## Rollout checklist for new APIs

1. Add or extend a reusable validator in `convex/crm/returnContracts.ts` (or a
   focused sibling module when the shape is domain-specific).
2. Register `returns` on the public `query` / `mutation` / `action` export.
3. Add contract fixtures for empty, partial, paginated/full, and malformed cases.
4. Run `cd convex && bunx tsc --noEmit` locally. Run target-aware codegen only after the deployment
   target is explicitly identified and authorized.
5. Run `bun run typecheck` when frontend clients consume the API.

Do not change permissions, args, handler branching, or client behavior when adding
return validators.
