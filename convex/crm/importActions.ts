"use node";

import { randomUUID } from "node:crypto";
import type { PaginationOptions } from "convex/server";
import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, internalAction } from "../_generated/server";
import { portalAccessArgumentValidator } from "../lib/importContractValidators";
import type { RuntimeValue } from "../lib/runtimeValues";
import {
  passengerExportDownloadValidator,
  passengerExportOperationResultValidator,
  passengerImportCommitResultValidator,
  passengerImportPreviewResultValidator,
} from "./importReturnContracts";
import {
  chunkRows,
  exportKindValidator,
  IMPORT_BATCH_SIZE,
  mergeRoomSummaries,
  preparePassengerRows,
  publicPassengerImportRow,
} from "./importRows";
import { IMPORT_WORKER_CONCURRENCY, mapWithConcurrency } from "./importWorkerPolicy";
import { CRM_LIST_MAX_ROWS_READ } from "./paginationPolicy";
import { continuePassengerExportRef } from "./passengerExportFunctionReferences";
import { PASSENGER_EXPORT_SOURCE_PAGE_SIZE } from "./passengerExportPolicy";
import { continuePassengerExportAction } from "./passengerExportWorker";
import { commitPassengerImportAction } from "./passengerImportCommit";
import { canManagePassengerKinds, canViewPassengerKinds } from "./passengerKindPolicy";

const COMMAND_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireImportAccess(ctx: any, rows: Array<{ importKind?: unknown }>) {
  const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
  if (!access?.allowed) {
    throw new ConvexError("FORBIDDEN");
  }

  const kinds = Array.from(new Set(rows.map((row) => row.importKind ?? "passenger")));
  if (!canManagePassengerKinds(access, kinds)) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
}

async function requireExportAccess(ctx: any, exportKind: RuntimeValue) {
  const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
  if (!access?.allowed) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!canViewPassengerKinds(access, [exportKind])) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
}

export function passengerExportPaginationOptions(cursor: string | null): PaginationOptions {
  return {
    cursor,
    maximumRowsRead: CRM_LIST_MAX_ROWS_READ,
    numItems: PASSENGER_EXPORT_SOURCE_PAGE_SIZE,
  };
}

export const previewPassengerImport = action({
  args: {
    jobCardId: v.id("jobCards"),
    rows: v.array(publicPassengerImportRow),
  },
  handler: async (ctx, args): Promise<any> => {
    if (args.rows.length > IMPORT_BATCH_SIZE) {
      throw new ConvexError(`Passenger import previews cannot exceed ${IMPORT_BATCH_SIZE} rows`);
    }
    const access = await requireImportAccess(ctx, args.rows);
    const preparedRows = preparePassengerRows(args.rows);
    const batches = chunkRows(preparedRows, IMPORT_BATCH_SIZE);
    let mergedRows: any[] = [];
    let roomSummary: Record<string, number> = {};

    const batchResults = await mapWithConcurrency(batches, IMPORT_WORKER_CONCURRENCY, (batch) =>
      ctx.runQuery(internal.crm.imports.previewPassengerImportRows, {
        access,
        jobCardId: args.jobCardId,
        rows: batch,
      })
    );
    for (const result of batchResults) {
      mergedRows = mergedRows.concat(result.rows);
      roomSummary = mergeRoomSummaries(roomSummary, result.roomSummary ?? {});
    }

    return { roomSummary, rows: mergedRows };
  },
  returns: passengerImportPreviewResultValidator,
});

export const commitPassengerImport = action({
  args: {
    jobCardId: v.id("jobCards"),
    operation: v.optional(
      v.object({
        batchIndex: v.number(),
        batchTotal: v.number(),
        complete: v.boolean(),
        importKinds: v.array(v.string()),
        sourceDigest: v.string(),
        total: v.number(),
      })
    ),
    rows: v.array(publicPassengerImportRow),
  },
  handler: async (ctx, args): Promise<any> => {
    const access = await requireImportAccess(ctx, args.rows);
    return await commitPassengerImportAction(ctx, access, args);
  },
  returns: passengerImportCommitResultValidator,
});

export const startPassengerExport = action({
  args: {
    commandId: v.string(),
    exportKind: exportKindValidator,
    jobCardId: v.id("jobCards"),
  },
  handler: async (ctx, args): Promise<{ operationId: Id<"passengerExportOperations"> }> => {
    if (!COMMAND_ID_PATTERN.test(args.commandId)) {
      throw new ConvexError("Command ID must be a UUID");
    }
    const access = await requireExportAccess(ctx, args.exportKind);
    const leaseId = randomUUID();
    const operation: {
      operationId: Id<"passengerExportOperations">;
      replayed: boolean;
    } = await ctx.runMutation(internal.crm.imports.beginPassengerExportOperation, {
      access,
      commandId: args.commandId,
      exportKind: args.exportKind,
      jobCardId: args.jobCardId,
      leaseId,
    });
    const { operationId } = operation;
    if (operation.replayed) {
      return { operationId };
    }
    await ctx.scheduler.runAfter(0, continuePassengerExportRef, {
      access,
      exportKind: args.exportKind,
      jobCardId: args.jobCardId,
      leaseId,
      operationId,
    });
    return { operationId };
  },
  returns: passengerExportOperationResultValidator,
});

export const continuePassengerExport = internalAction({
  args: {
    access: portalAccessArgumentValidator,
    exportKind: exportKindValidator,
    jobCardId: v.id("jobCards"),
    leaseId: v.string(),
    operationId: v.id("passengerExportOperations"),
  },
  handler: continuePassengerExportAction,
  returns: v.null(),
});

export const getPassengerExportDownload = action({
  args: { operationId: v.id("passengerExportOperations") },
  handler: async (ctx, args): Promise<{ fileName: string; url: string }> => {
    const operation: Doc<"passengerExportOperations"> | null = await ctx.runQuery(
      internal.crm.imports.getPassengerExportOperation,
      {
        operationId: args.operationId,
      }
    );
    if (
      !(
        operation?.status === "completed" &&
        operation.storageId &&
        operation.fileName &&
        operation.expiresAt &&
        operation.expiresAt > Date.now()
      )
    ) {
      throw new ConvexError("Export file is not ready");
    }
    const access = await requireExportAccess(ctx, operation.exportKind);
    await ctx.runQuery(internal.crm.imports.getAuthorizedPassengerExportOperation, {
      access,
      operationId: args.operationId,
    });
    return {
      fileName: operation.fileName,
      url: `/api/portal/exports/${encodeURIComponent(String(operation._id))}`,
    };
  },
  returns: passengerExportDownloadValidator,
});
