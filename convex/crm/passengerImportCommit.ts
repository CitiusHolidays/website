"use node";

import { createHash } from "node:crypto";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { passengerImportBatchCount, passengerImportBatchRowCount } from "./importBatchPolicy";
import {
  chunkRows,
  IMPORT_BATCH_SIZE,
  type InternalPassengerImportRow,
  mergeRoomSummaries,
  type PublicPassengerImportRow,
  preparePassengerRows,
} from "./importRows";
import {
  classifyImportError,
  type ImportBatchResult,
  publicImportErrorMessage,
  stableImportBatchId,
  summarizeImportBatchResults,
} from "./importWorkerPolicy";
import type { PortalAccess } from "./lib";
import type { RecordPassengerImportBatchArgs } from "./passengerImportOperations";
import type {
  claimPassengerImportOperationBatchHandler,
  getPassengerImportBatchResultHandler,
} from "./passengerImportReceipts";
import type {
  commitPassengerImportRowHandler,
  previewPassengerImportRowsHandler,
} from "./passengerImportRows";

const SOURCE_DIGEST_PATTERN = /^[0-9a-f]{64}$/i;
const ACTIVE_BATCH_RETRY_INTERVAL_MS = 250;
const ACTIVE_BATCH_RETRY_LIMIT = 80;

const recordPassengerImportOperationBatchRef = makeFunctionReference<
  "mutation",
  RecordPassengerImportBatchArgs,
  null
>("crm/imports:recordPassengerImportOperationBatch");

interface PassengerImportOperationManifest {
  batchIndex: number;
  batchTotal: number;
  complete: boolean;
  importKinds: string[];
  sourceDigest: string;
  total: number;
}

export interface PassengerImportCommitArgs {
  jobCardId: Id<"jobCards">;
  operation?: PassengerImportOperationManifest;
  rows: PublicPassengerImportRow[];
}

type CommittedPassengerRow = Awaited<ReturnType<typeof commitPassengerImportRowHandler>>;
type PassengerImportPreview = Awaited<ReturnType<typeof previewPassengerImportRowsHandler>>;
type PassengerImportBatchClaim = Awaited<
  ReturnType<typeof claimPassengerImportOperationBatchHandler>
>;
type StoredPassengerImportBatch = Awaited<ReturnType<typeof getPassengerImportBatchResultHandler>>;

interface RowMatchState {
  byImportKey: Map<string, Id<"travellers">>;
  byName: Map<string, Id<"travellers">>;
  byPassportHash: Map<string, Id<"travellers">>;
  preview: Map<string, Id<"travellers">>;
}

function operationKinds(rows: PublicPassengerImportRow[]) {
  return Array.from(new Set(rows.map((row) => String(row.importKind ?? "passenger")))).sort();
}

function assertOperationManifest(args: PassengerImportCommitArgs, kinds: string[]) {
  if (!args.operation) {
    return;
  }
  const { batchIndex, batchTotal, complete, importKinds, sourceDigest, total } = args.operation;
  const normalizedKinds = Array.from(new Set(importKinds.map(String))).sort();
  const valid =
    [batchIndex, batchTotal, total].every(Number.isSafeInteger) &&
    total >= 1 &&
    batchTotal === passengerImportBatchCount(total) &&
    batchIndex >= 0 &&
    batchIndex < batchTotal &&
    complete === (batchIndex === batchTotal - 1) &&
    args.rows.length === passengerImportBatchRowCount(total, batchIndex) &&
    SOURCE_DIGEST_PATTERN.test(sourceDigest) &&
    kinds.every((kind) => normalizedKinds.includes(kind));
  if (!valid) {
    throw new ConvexError("Invalid passenger import operation manifest");
  }
}

function assertPreparedRowIdentities(rows: InternalPassengerImportRow[]) {
  const rowIds = new Set<string>();
  const importKeys = new Set<string>();
  const sourcePositions = new Set<string>();
  for (const row of rows) {
    const rowId = row.id.trim();
    const importKey = row.importKey.trim();
    const sourceSheet = row.sourceSheet.trim();
    const sourcePosition = `${sourceSheet}:${row.sourceRowNumber}`;
    const identityIsValid =
      rowId &&
      importKey &&
      sourceSheet &&
      Number.isSafeInteger(row.sourceRowNumber) &&
      row.sourceRowNumber >= 1;
    const identityIsUnique = !(
      rowIds.has(rowId) ||
      importKeys.has(importKey) ||
      sourcePositions.has(sourcePosition)
    );
    if (!(identityIsValid && identityIsUnique)) {
      throw new ConvexError("Passenger import rows require unique row and source identities");
    }
    rowIds.add(rowId);
    importKeys.add(importKey);
    sourcePositions.add(sourcePosition);
  }
}

export function preparePassengerImportCommit(args: PassengerImportCommitArgs) {
  if (args.rows.length > IMPORT_BATCH_SIZE) {
    throw new ConvexError(`Passenger import batches cannot exceed ${IMPORT_BATCH_SIZE} rows`);
  }
  if (args.rows.length === 0) {
    throw new ConvexError("Passenger import requires at least one row");
  }
  const kinds = operationKinds(args.rows);
  assertOperationManifest(args, kinds);
  const preparedRows = preparePassengerRows(args.rows);
  assertPreparedRowIdentities(preparedRows);
  return { kinds, preparedRows };
}

function emptyBatchResult(batchId: string, accepted: number): ImportBatchResult {
  return {
    accepted,
    batchId,
    created: 0,
    errors: [],
    failed: 0,
    processed: 0,
    remaining: accepted,
    roomSummary: {},
    rowResults: [],
    status: "processing",
    updated: 0,
  };
}

function expectedTravellerId(state: RowMatchState, row: InternalPassengerImportRow) {
  return (
    state.byPassportHash.get(row.passportNumberHash ?? "") ??
    state.byImportKey.get(row.importKey) ??
    state.byName.get(row.fullName.trim().toLowerCase()) ??
    state.preview.get(row.id)
  );
}

function recordSuccessfulRow(
  state: RowMatchState,
  result: ImportBatchResult,
  row: InternalPassengerImportRow,
  rowResult: CommittedPassengerRow
) {
  result.created += rowResult.created;
  result.updated += rowResult.updated;
  result.processed += rowResult.processed;
  result.remaining -= rowResult.processed;
  result.rowResults = (result.rowResults ?? []).concat(rowResult.rowResults);
  result.roomSummary = mergeRoomSummaries(result.roomSummary, rowResult.roomSummary);
  state.byImportKey.set(row.importKey, rowResult.travellerId);
  state.byName.set(row.fullName.trim().toLowerCase(), rowResult.travellerId);
  if (row.passportNumberHash) {
    state.byPassportHash.set(row.passportNumberHash, rowResult.travellerId);
  }
}

function recordFailedRow(
  result: ImportBatchResult,
  batchId: string,
  rowIndex: number,
  row: InternalPassengerImportRow,
  error: unknown
) {
  const kind = classifyImportError(error);
  const message = publicImportErrorMessage(error);
  const rowId = `${batchId}:row:${rowIndex}`;
  result.failed += 1;
  if (kind === "terminal") {
    result.processed += 1;
    result.remaining -= 1;
  }
  result.errors.push({ id: rowId, kind, message });
  result.rowResults = (result.rowResults ?? []).concat({
    disposition: "failed",
    fullName: row.fullName.trim(),
    id: rowId,
    message,
    sourceRowNumber: row.sourceRowNumber,
    sourceSheet: row.sourceSheet,
  });
}

async function commitPreparedRow(
  ctx: ActionCtx,
  access: PortalAccess,
  jobCardId: Id<"jobCards">,
  batchId: string,
  rowIndex: number,
  row: InternalPassengerImportRow,
  state: RowMatchState,
  result: ImportBatchResult
) {
  const matchId = expectedTravellerId(state, row);
  try {
    const rowResult: CommittedPassengerRow = await ctx.runMutation(
      internal.crm.imports.commitPassengerImportRow,
      {
        access,
        ...(matchId ? { expectedTravellerId: matchId } : {}),
        jobCardId,
        row,
      }
    );
    recordSuccessfulRow(state, result, row, rowResult);
  } catch (error) {
    recordFailedRow(result, batchId, rowIndex, row, error);
  }
}

async function recordBatchResult(
  ctx: ActionCtx,
  jobCardId: Id<"jobCards">,
  operationId: Id<"passengerImportOperations">,
  batchIndex: number,
  result: ImportBatchResult
) {
  const status = result.status as "completed" | "retryable";
  await ctx.runMutation(internal.crm.imports.finalizePassengerImportBatch, {
    accepted: result.accepted,
    batchId: result.batchId,
    created: result.created,
    errors: result.errors,
    failed: result.failed,
    jobCardId,
    operationId,
    processed: result.processed,
    remaining: result.remaining,
    roomSummary: result.roomSummary,
    status,
    updated: result.updated,
  });
  await ctx.runMutation(recordPassengerImportOperationBatchRef, {
    accepted: result.accepted,
    batchId: result.batchId,
    batchIndex,
    created: result.created,
    errorSummary: result.errors.reduce(
      (counts, error) => {
        counts[error.kind] += 1;
        return counts;
      },
      { retryable: 0, terminal: 0 }
    ),
    failed: result.failed,
    operationId,
    processed: result.processed,
    remaining: result.remaining,
    roomSummary: result.roomSummary,
    status,
    updated: result.updated,
  });
}

async function processClaimedBatch(
  ctx: ActionCtx,
  access: PortalAccess,
  jobCardId: Id<"jobCards">,
  operationId: Id<"passengerImportOperations">,
  batchIndex: number,
  batchId: string,
  batch: InternalPassengerImportRow[]
) {
  const claimBatch = async (attempt: number): Promise<PassengerImportBatchClaim> => {
    const claim: PassengerImportBatchClaim = await ctx.runMutation(
      internal.crm.imports.claimPassengerImportOperationBatch,
      {
        batchId,
        batchIndex,
        operationId,
        rowCount: batch.length,
      }
    );
    if (claim.mode !== "wait") {
      return claim;
    }
    if (attempt >= ACTIVE_BATCH_RETRY_LIMIT) {
      throw new ConvexError("Passenger import batch is still processing");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, ACTIVE_BATCH_RETRY_INTERVAL_MS));
    return claimBatch(attempt + 1);
  };
  const claim = await claimBatch(1);
  if (claim.mode === "replay") {
    const replay: StoredPassengerImportBatch = await ctx.runQuery(
      internal.crm.imports.getPassengerImportBatchResult,
      { batchId, jobCardId }
    );
    if (replay?.status !== "completed") {
      throw new ConvexError("Completed passenger import receipt has no completed batch ledger");
    }
    return replay;
  }

  const preview: PassengerImportPreview = await ctx.runQuery(
    internal.crm.imports.previewPassengerImportRows,
    { access, jobCardId, rows: batch }
  );
  const state: RowMatchState = {
    byImportKey: new Map(),
    byName: new Map(),
    byPassportHash: new Map(),
    preview: new Map(
      preview.rows.flatMap((row) => (row.travellerId ? [[row.id, row.travellerId]] : []))
    ),
  };
  const result = emptyBatchResult(batchId, batch.length);
  for (const [rowIndex, row] of batch.entries()) {
    // biome-ignore lint/performance/noAwaitInLoops: dependent identity matches must commit in source order.
    await commitPreparedRow(ctx, access, jobCardId, batchId, rowIndex, row, state, result);
  }
  result.status = result.remaining > 0 ? "retryable" : "completed";
  await recordBatchResult(ctx, jobCardId, operationId, batchIndex, result);
  return result;
}

async function logCompletedImport(
  ctx: ActionCtx,
  access: PortalAccess,
  args: PassengerImportCommitArgs,
  kinds: string[],
  importedCount: number
) {
  if (args.operation && !args.operation.complete) {
    return;
  }
  try {
    await ctx.runMutation(internal.crm.imports.logPassengerImportActivity, {
      access,
      importedCount,
      importKind: kinds[0] ?? "passenger",
      jobCardId: args.jobCardId,
    });
  } catch (activityError) {
    console.error("Failed to log completed passenger import:", activityError);
  }
}

export async function commitPassengerImportAction(
  ctx: ActionCtx,
  access: PortalAccess,
  args: PassengerImportCommitArgs
) {
  const { kinds, preparedRows } = preparePassengerImportCommit(args);
  const batches = chunkRows(preparedRows, IMPORT_BATCH_SIZE);
  const manifest = args.operation;
  const firstBatchIndex = manifest ? manifest.batchIndex : 0;
  const batchIds = batches.map((batch, index) =>
    stableImportBatchId(args.jobCardId, firstBatchIndex + index, batch)
  );
  const sourceDigest = manifest
    ? manifest.sourceDigest
    : createHash("sha256")
        .update(`${args.jobCardId}:${batchIds.join(":")}`)
        .digest("hex");
  const operationId = await ctx.runMutation(internal.crm.imports.beginPassengerImportOperation, {
    access,
    batchTotal: manifest ? manifest.batchTotal : batches.length,
    importKinds: kinds,
    jobCardId: args.jobCardId,
    sourceDigest,
    total: manifest ? manifest.total : preparedRows.length,
  });
  const batchResults: ImportBatchResult[] = [];
  for (const [index, batch] of batches.entries()) {
    const batchIndex = firstBatchIndex + index;
    const batchId = batchIds[index] ?? stableImportBatchId(args.jobCardId, batchIndex, batch);
    // biome-ignore lint/performance/noAwaitInLoops: import batches preserve manifest order.
    const result = await processClaimedBatch(
      ctx,
      access,
      args.jobCardId,
      operationId,
      batchIndex,
      batchId,
      batch
    );
    batchResults.push(result);
  }
  const summary = summarizeImportBatchResults(batchResults);
  await ctx.runMutation(internal.crm.imports.completePassengerImportOperation, { operationId });
  await logCompletedImport(ctx, access, args, kinds, summary.created + summary.updated);
  return {
    ...summary,
    batches: batchResults.map(({ batchId, errors, status }) => ({
      batchId,
      errors: errors.map(({ id, kind, message }) => ({ id, kind, message })),
      status,
    })),
    operationId,
    total: preparedRows.length,
  };
}
