# Commercial File retention operations

Commercial Files remain recoverable for 14 days after an authorized delete. Permanent purge is a
system-only operation and never changes source/team authorization or Proposal Doc history rules.

## Bounded purge contract

The daily `purge expired commercial files` cron starts one `commercialFilePurgeRuns` generation.
Its fixed `cutoffAt` prevents rows becoming eligible mid-run from changing the page set. Two stages
process expired upload-session quarantine rows first and recoverably deleted Commercial Files
second. Each `continuePurgeExpired` mutation reads at most 10 indexed rows.

Every continuation carries the run ID and exact continuation number. A replay or stale scheduled
call returns current state without doing work. One singleton `commercialFilePurgeState` row prevents
overlapping active generations. A queued/running lease expires after five minutes; a later kickoff
marks that run failed before creating a new generation, so a lost continuation cannot fence cleanup
forever.

For every row, storage-reference checks stay inside the authoritative mutation:

- referenced blobs survive while expired session/file metadata can be removed;
- unreferenced blobs are deleted before their metadata in the same transaction;
- a storage deletion failure leaves metadata intact and retryable;
- a failed row does not block later rows because the page cursor still advances;
- failures complete the generation as `completed_with_failures`; there is no zero-delay retry loop.

Each page writes at most one compact `commercial_file_purge_page` Activity record with no bytes,
storage ID, signed URL, token, or secret. File audit entries retain only safe file/source provenance.
The run stores processed, purged, and failed counts separately for sessions and files.

## Operator checks

`crm/commercialFiles:getPurgeStatus` returns the latest bounded summary. `completed` means every row
in that generation was purged or safely dereferenced. `completed_with_failures` means one or more
metadata rows remain retryable. `failed` with `lease_expired` means a continuation stopped before a
terminal state; a later kickoff creates a fenced generation.

Source tests prove multi-page completion, stale replay, shared-storage preservation, later-row
progress after failures, audit bounds, and injected storage failure. Deployed cron history, storage
behavior, and run counts require observation on an explicitly identified non-production Convex
Preview. Local source evidence is not deployment or Production cleanup proof.
