"use node";

import { createHash, randomUUID } from "node:crypto";
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
  type ImportBatchResult,
  mapWithConcurrency,
  publicImportErrorMessage,
  stableImportBatchId,
  summarizeImportBatchResults,
} from "./importWorkerPolicy";
import { PERMISSIONS } from "./lib/rolePolicy";
import { buildPassengerExportFile } from "./passengerExportWorkbook";
import { cleanPassportField } from "./passportExpiry";

const PASSENGER_EXPORT_PAGE_SIZE = 100;
const COMMAND_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value?: string) {
  return String(value ?? "").trim();
}

function hasPermission(access: any, permission: string) {
  return access?.permissions?.includes(permission);
}

function hasAllPermissions(access: any, permissions: string[]) {
  return permissions.every((permission) => hasPermission(access, permission));
}

async function requireImportAccess(ctx: any, rows: any[]) {
  const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
  if (!access?.allowed) {
    throw new ConvexError("FORBIDDEN");
  }

  const kinds = new Set(rows.map((row) => row.importKind ?? "passenger"));
  for (const kind of kinds) {
    if (
      kind === "passenger" &&
      !(
        hasPermission(access, PERMISSIONS.MANAGE_TICKETING) ||
        hasAllPermissions(access, [PERMISSIONS.MANAGE_TRAVELLERS, PERMISSIONS.MANAGE_VISA])
      )
    ) {
      throw new ConvexError("FORBIDDEN");
    }
    if (
      kind === "traveller" &&
      !hasAllPermissions(access, [PERMISSIONS.MANAGE_TRAVELLERS, PERMISSIONS.MANAGE_VISA])
    ) {
      throw new ConvexError("FORBIDDEN");
    }
    if (kind === "rooming" && !hasPermission(access, PERMISSIONS.MANAGE_OPERATIONS)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (
      (kind === "passport" || kind === "visa") &&
      !hasPermission(access, PERMISSIONS.MANAGE_VISA)
    ) {
      throw new ConvexError("FORBIDDEN");
    }
  }
  return access;
}

async function requireExportAccess(ctx: any, exportKind: string) {
  const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
  if (!access?.allowed) {
    throw new ConvexError("FORBIDDEN");
  }

  if (
    exportKind === "passenger" &&
    !(
      hasPermission(access, PERMISSIONS.VIEW_TICKETING) ||
      hasAllPermissions(access, [PERMISSIONS.VIEW_TRAVELLERS, PERMISSIONS.VIEW_VISA])
    )
  ) {
    throw new ConvexError("FORBIDDEN");
  }
  if (
    exportKind === "traveller" &&
    !hasAllPermissions(access, [PERMISSIONS.VIEW_TRAVELLERS, PERMISSIONS.VIEW_VISA])
  ) {
    throw new ConvexError("FORBIDDEN");
  }
  if (exportKind === "rooming" && !hasPermission(access, PERMISSIONS.VIEW_OPERATIONS)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (
    (exportKind === "passport" || exportKind === "visa") &&
    !hasPermission(access, PERMISSIONS.VIEW_VISA)
  ) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
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
    if (args.rows.length > IMPORT_BATCH_SIZE) {
      throw new ConvexError(`Passenger import batches cannot exceed ${IMPORT_BATCH_SIZE} rows`);
    }
    const operationKinds = Array.from(
      new Set(args.rows.map((row) => String(row.importKind ?? "passenger")))
    ).sort();
    if (args.operation) {
      const { batchIndex, batchTotal, complete, importKinds, sourceDigest, total } = args.operation;
      const expectedBatchTotal = Math.ceil(total / IMPORT_BATCH_SIZE);
      const expectedRows = Math.min(IMPORT_BATCH_SIZE, total - batchIndex * IMPORT_BATCH_SIZE);
      const validIntegers = [batchIndex, batchTotal, total].every(Number.isSafeInteger);
      const normalizedKinds = Array.from(new Set(importKinds.map(String))).sort();
      if (
        !validIntegers ||
        total < 1 ||
        batchTotal !== expectedBatchTotal ||
        batchIndex < 0 ||
        batchIndex >= batchTotal ||
        complete !== (batchIndex === batchTotal - 1) ||
        args.rows.length !== expectedRows ||
        !/^[0-9a-f]{64}$/i.test(sourceDigest) ||
        JSON.stringify(normalizedKinds) !== JSON.stringify(operationKinds)
      ) {
        throw new ConvexError("Invalid passenger import operation manifest");
      }
    }
    const access = await requireImportAccess(ctx, args.rows);
    const preparedRows = preparePassengerRows(args.rows);
    const batches = chunkRows(preparedRows, IMPORT_BATCH_SIZE);
    const batchIds = batches.map((batch, index) =>
      stableImportBatchId(args.jobCardId, (args.operation?.batchIndex ?? 0) + index, batch)
    );
    const sourceDigest =
      args.operation?.sourceDigest ??
      createHash("sha256")
        .update(`${args.jobCardId}:${batchIds.join(":")}`)
        .digest("hex");
    const operationId = await ctx.runMutation(internal.crm.imports.beginPassengerImportOperation, {
      access,
      batchTotal: args.operation?.batchTotal ?? batches.length,
      importKinds: operationKinds,
      jobCardId: args.jobCardId,
      sourceDigest,
      total: args.operation?.total ?? preparedRows.length,
    });
    const batchResults = await mapWithConcurrency(
      batches,
      IMPORT_WORKER_CONCURRENCY,
      async (batch, index) => {
        const batchId = batchIds[index] ?? stableImportBatchId(args.jobCardId, index, batch);
        let result: ImportBatchResult;
        try {
          result = await ctx.runMutation(internal.crm.imports.commitPassengerImportBatch, {
            access,
            batchId,
            jobCardId: args.jobCardId,
            logActivity: args.operation
              ? args.operation.complete && index === batches.length - 1
              : index === batches.length - 1,
            rows: batch,
          });
        } catch (error) {
          result = {
            accepted: batch.length,
            batchId,
            created: 0,
            errors: [
              {
                id: batchId,
                kind: classifyImportError(error),
                message: publicImportErrorMessage(error),
              },
            ],
            failed: batch.length,
            processed: 0,
            remaining: batch.length,
            roomSummary: {},
            status: classifyImportError(error),
            updated: 0,
          };
        }
        await ctx.runMutation(internal.crm.imports.recordPassengerImportOperationBatch, {
          accepted: result.accepted,
          batchId,
          created: result.created,
          errorSummary: result.errors.reduce(
            (errorCounts, error) => {
              errorCounts[error.kind] += 1;
              return errorCounts;
            },
            { retryable: 0, terminal: 0 }
          ),
          failed: result.failed,
          operationId,
          processed: result.processed,
          remaining: result.remaining,
          roomSummary: result.roomSummary,
          updated: result.updated,
        });
        return result;
      }
    );
    const summary = summarizeImportBatchResults(batchResults);
    if (!args.operation || args.operation.complete) {
      await ctx.runMutation(internal.crm.imports.completePassengerImportOperation, { operationId });
    }

    return {
      ...summary,
      batches: batchResults.map(({ batchId, errors, status }) => ({ batchId, errors, status })),
      operationId,
      total: preparedRows.length,
    };
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
          jobCardId: args.jobCardId,
          paginationOpts: { cursor, numItems: PASSENGER_EXPORT_PAGE_SIZE },
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
