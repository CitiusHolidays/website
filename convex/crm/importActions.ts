"use node";

import { randomUUID } from "node:crypto";
import type { PaginationOptions } from "convex/server";
import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { decryptPassportDetails } from "../lib/encryption";
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
import {
  classifyImportError,
  IMPORT_WORKER_CONCURRENCY,
  mapWithConcurrency,
} from "./importWorkerPolicy";
import { CRM_LIST_MAX_ROWS_READ } from "./paginationPolicy";
import { buildPassengerExportFile } from "./passengerExportWorkbook";
import { commitPassengerImportAction } from "./passengerImportCommit";
import { canManagePassengerKinds, canViewPassengerKinds } from "./passengerKindPolicy";
import { cleanPassportField } from "./passportExpiry";

const PASSENGER_EXPORT_PAGE_SIZE = 100;
const COMMAND_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value?: string) {
  return String(value ?? "").trim();
}

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

async function requireExportAccess(ctx: any, exportKind: unknown) {
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
    numItems: PASSENGER_EXPORT_PAGE_SIZE,
  };
}

function mapPassengerExportRow(row: any) {
  let passport = {
    dateOfBirth: "",
    expiryDate: "",
    issueDate: "",
    number: "",
  };

  if (row.encryptedPassportPayload) {
    try {
      const decrypted = decryptPassportDetails(row.encryptedPassportPayload);
      passport = {
        dateOfBirth: cleanPassportField(decrypted.dateOfBirth),
        expiryDate: cleanPassportField(decrypted.expiryDate),
        issueDate: cleanPassportField(decrypted.issueDate),
        number: cleanPassportField(decrypted.number),
      };
    } catch {
      passport = { dateOfBirth: "", expiryDate: "", issueDate: "", number: "" };
    }
  }

  return {
    contactNo: row.contactNo,
    foodPreference: row.foodPreference,
    fullName: row.fullName,
    gender: row.gender,
    givenName: row.givenName,
    hotelAllocation: row.hotelAllocation,
    passport,
    paymentType: row.paymentType,
    roomType: row.roomType,
    sourceDealerCode: row.sourceDealerCode,
    sourceDealerName: row.sourceDealerName,
    sourceDescription: row.sourceDescription,
    sourceGroup: row.sourceGroup,
    sourceRowNumber: row.sourceRowNumber,
    sourceRsoName: row.sourceRsoName,
    sourceSheet: row.sourceSheet,
    sourceSoName: row.sourceSoName,
    specialRequests: row.specialRequests,
    surname: row.surname,
    ticketing: buildTicketingExport(row.tickets ?? []),
    travelBatchCode: row.travelBatchCode,
    travelBatchId: row.travelBatchId,
    travelBatchReference: row.travelBatchReference,
    travelHub: row.travelHub,
    visa: row.visa ?? {
      appointmentDate: "",
      notes: "",
      status: row.visaStatus,
    },
    visaRequired: row.visaRequired,
    visaStatus: row.visaStatus,
    willingToGo: row.cancellation || row.lastMinuteDrop ? "UNABLE TO GO" : "CONFIRMED",
  };
}

function passengerExportSourceOrder(a: any, b: any) {
  const aImported = typeof a.sourceRowNumber === "number";
  const bImported = typeof b.sourceRowNumber === "number";
  if (aImported !== bImported) {
    return aImported ? -1 : 1;
  }
  if (aImported && bImported) {
    const sheet = String(a.sourceSheet ?? "").localeCompare(String(b.sourceSheet ?? ""));
    if (sheet !== 0) {
      return sheet;
    }
    if (a.sourceRowNumber !== b.sourceRowNumber) {
      return a.sourceRowNumber - b.sourceRowNumber;
    }
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt - b.createdAt;
  }
  return String(a.fullName).localeCompare(String(b.fullName));
}

function isDomesticTicket(ticket: any) {
  const text = [ticket.ticketType, ticket.fareType, ticket.route, ticket.pnrCode, ticket.airline]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes("domestic");
}

function joinUnique(values: Array<string | undefined>) {
  return Array.from(
    values.reduce((set, value) => {
      const text = clean(value);
      if (text) {
        set.add(text);
      }
      return set;
    }, new Set<string>())
  ).join(" / ");
}

function buildTicketingExport(tickets: any[]) {
  const domestic = tickets.filter(isDomesticTicket);
  const international = tickets.filter((ticket) => !isDomesticTicket(ticket));

  return {
    domesticPnr: joinUnique(domestic.map((ticket) => ticket.pnrCode)),
    domesticTicket: joinUnique(domestic.map((ticket) => ticket.ticketNumber)),
    domesticVendor: "",
    internationalFare: "",
    internationalPnr: joinUnique(international.map((ticket) => ticket.pnrCode)),
    internationalVendor: "",
  };
}

export const previewPassengerImport = action({
  args: {
    jobCardId: v.string(),
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
    jobCardId: v.string(),
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
    jobCardId: v.string(),
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
    let generatedStorageId: Id<"_storage"> | null = null;
    try {
      let cursor: string | null = null;
      let isDone = false;
      let rowsProcessed = 0;
      let jobCode = "job-card";
      const sourceRows: any[] = [];
      while (!isDone) {
        // biome-ignore lint/performance/noAwaitInLoops: cursor pages must be read in order.
        const page: any = await ctx.runQuery(internal.crm.imports.getPassengerExportSourcePage, {
          access,
          exportKind: args.exportKind,
          jobCardId: args.jobCardId,
          paginationOpts: passengerExportPaginationOptions(cursor),
        });
        const { continueCursor, isDone: pageIsDone, jobCode: pageJobCode, page: pageRows } = page;
        sourceRows.push(...pageRows);
        rowsProcessed += pageRows.length;
        jobCode = pageJobCode;
        cursor = continueCursor;
        isDone = pageIsDone;
        await ctx.runMutation(internal.crm.imports.updatePassengerExportOperation, {
          leaseId,
          operationId,
          rowsProcessed,
        });
      }
      sourceRows.sort(passengerExportSourceOrder);
      const rows = sourceRows.map(mapPassengerExportRow);
      const file = await buildPassengerExportFile(args.exportKind, jobCode, rows);
      generatedStorageId = await ctx.storage.store(
        new Blob([file.buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
      await ctx.runMutation(internal.crm.imports.stagePassengerExportArtifact, {
        fileName: file.fileName,
        leaseId,
        operationId,
        storageId: generatedStorageId,
      });
      await ctx.runMutation(internal.crm.imports.completePassengerExportOperation, {
        leaseId,
        operationId,
        rowsProcessed,
      });
      try {
        await ctx.runMutation(internal.crm.imports.logPassengerExport, {
          access,
          exportKind: args.exportKind,
          jobCardId: args.jobCardId,
          rowCount: rowsProcessed,
        });
      } catch (activityError) {
        console.error("Failed to log completed passenger export:", activityError);
      }
      return { operationId };
    } catch (error) {
      await ctx.runMutation(internal.crm.imports.failPassengerExportOperation, {
        artifactDeleted: true,
        errorCode: classifyImportError(error) === "retryable" ? "retryable" : "export_failed",
        leaseId,
        operationId,
      });
      if (generatedStorageId) {
        await ctx.runMutation(internal.crm.storageReferences.deleteIfUnreferenced, {
          storageId: generatedStorageId,
        });
      }
      throw error;
    }
  },
  returns: passengerExportOperationResultValidator,
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
