"use node";

import { once } from "node:events";
import { createReadStream, createWriteStream, openAsBlob } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { ConvexError } from "convex/values";
import type {
  PassengerExportKind,
  PassengerExportRow,
} from "../../src/lib/portal/passengerExportContract";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { decryptPassportDetails } from "../lib/encryption";
import { isRuntimeNumber, isRuntimeString } from "../lib/runtimeValues";
import { classifyImportError } from "./importWorkerPolicy";
import type { PortalAccess } from "./lib";
import { CRM_LIST_MAX_ROWS_READ } from "./paginationPolicy";
import {
  continuePassengerExportRef,
  getPassengerExportSourcePageRef,
  listPassengerExportSourceChunksRef,
  stagePassengerExportSourceChunkRef,
} from "./passengerExportFunctionReferences";
import {
  PASSENGER_EXPORT_MAX_CHUNK_BYTES,
  PASSENGER_EXPORT_MAX_ROW_BYTES,
  PASSENGER_EXPORT_MERGE_FAN_IN,
  PASSENGER_EXPORT_PAGES_PER_WORKER,
  PASSENGER_EXPORT_SOURCE_PAGE_SIZE,
} from "./passengerExportPolicy";
import type {
  PassengerExportSortableRow,
  PassengerExportSourceRow,
  PassengerExportSourceTicket,
} from "./passengerExportSourceContract";
import { writePassengerExportFile } from "./passengerExportWorkbook";
import { cleanPassportField } from "./passportExpiry";

const WORKBOOK_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface PassengerExportWorkerArgs {
  access: PortalAccess;
  exportKind: PassengerExportKind;
  jobCardId: Id<"jobCards">;
  leaseId: string;
  operationId: Id<"passengerExportOperations">;
}

function clean(value?: string) {
  return String(value ?? "").trim();
}

function isDomesticTicket(ticket: PassengerExportSourceTicket) {
  return [ticket.ticketType, ticket.fareType, ticket.route, ticket.pnrCode, ticket.airline]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes("domestic");
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

function buildTicketingExport(tickets: PassengerExportSourceTicket[]) {
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

export function mapPassengerExportRow(row: PassengerExportSourceRow): PassengerExportSortableRow {
  let passport = { dateOfBirth: "", expiryDate: "", issueDate: "", number: "" };
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
    createdAt: row.createdAt,
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
    ticketing: buildTicketingExport(row.tickets),
    travelBatchCode: row.travelBatchCode,
    travelBatchId: row.travelBatchId,
    travelBatchReference: row.travelBatchReference,
    travelHub: row.travelHub,
    visa: row.visa,
    visaRequired: row.visaRequired,
    visaStatus: row.visaStatus,
    willingToGo: row.cancellation || row.lastMinuteDrop ? "UNABLE TO GO" : "CONFIRMED",
  };
}

export function passengerExportSourceOrder(
  left: PassengerExportSortableRow,
  right: PassengerExportSortableRow
) {
  const leftImported = isRuntimeNumber(left.sourceRowNumber);
  const rightImported = isRuntimeNumber(right.sourceRowNumber);
  if (leftImported !== rightImported) {
    return leftImported ? -1 : 1;
  }
  if (leftImported && rightImported) {
    const sheet = String(left.sourceSheet ?? "").localeCompare(String(right.sourceSheet ?? ""));
    if (sheet !== 0) {
      return sheet;
    }
    if (left.sourceRowNumber !== right.sourceRowNumber) {
      return Number(left.sourceRowNumber) - Number(right.sourceRowNumber);
    }
  }
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  return String(left.fullName).localeCompare(String(right.fullName));
}

export function serializePassengerExportChunk(rows: PassengerExportSortableRow[]) {
  const lines = rows.map((row) => JSON.stringify(row));
  if (lines.some((line) => Buffer.byteLength(line) > PASSENGER_EXPORT_MAX_ROW_BYTES)) {
    throw new ConvexError("Passenger export contains a row above the safe worker byte budget");
  }
  const payload = `${lines.join("\n")}${lines.length > 0 ? "\n" : ""}`;
  if (Buffer.byteLength(payload) > PASSENGER_EXPORT_MAX_CHUNK_BYTES) {
    throw new ConvexError("Passenger export source page exceeded the safe worker byte budget");
  }
  return payload;
}

function parseSortableRow(line: string): PassengerExportSortableRow {
  // SAFETY: the following checks validate every field required from the serialized sortable row.
  const row = JSON.parse(line) as Partial<PassengerExportSortableRow>;
  if (!(isRuntimeNumber(row.createdAt) && isRuntimeString(row.fullName))) {
    throw new ConvexError("Passenger export source chunk is malformed");
  }
  // SAFETY: createdAt and fullName are the only required fields; remaining fields are optional.
  return row as PassengerExportSortableRow;
}

async function writeLine(stream: ReturnType<typeof createWriteStream>, line: string) {
  if (!stream.write(`${line}\n`)) {
    await once(stream, "drain");
  }
}

async function mergeFileGroup(inputPaths: string[], outputPath: string) {
  const readers = inputPaths.map((path) => createInterface({ input: createReadStream(path) }));
  const iterators = readers.map((reader) => reader[Symbol.asyncIterator]());
  const current = await Promise.all(iterators.map((iterator) => iterator.next()));
  const output = createWriteStream(outputPath);
  try {
    while (current.some((entry) => !entry.done)) {
      let selected = -1;
      let selectedRow: PassengerExportSortableRow | null = null;
      for (let index = 0; index < current.length; index += 1) {
        const entry = current[index];
        if (entry?.done) {
          continue;
        }
        const row = parseSortableRow(entry.value);
        if (!selectedRow || passengerExportSourceOrder(row, selectedRow) < 0) {
          selected = index;
          selectedRow = row;
        }
      }
      if (selected < 0 || !selectedRow) {
        break;
      }
      // biome-ignore lint/performance/noAwaitInLoops: merge readers advance in global sort order.
      await writeLine(output, JSON.stringify(selectedRow));
      current[selected] = await iterators[selected].next();
    }
    output.end();
    await once(output, "finish");
  } finally {
    for (const reader of readers) {
      reader.close();
    }
  }
}

export async function mergePassengerExportChunkFiles(paths: string[], directory: string) {
  if (paths.length === 0) {
    const empty = join(directory, "merged-empty.jsonl");
    await writeFile(empty, "");
    return empty;
  }
  let generation = 0;
  let active = [...paths];
  while (active.length > 1) {
    const next: string[] = [];
    for (let offset = 0; offset < active.length; offset += PASSENGER_EXPORT_MERGE_FAN_IN) {
      const output = join(directory, `merge-${generation}-${next.length}.jsonl`);
      await mergeFileGroup(active.slice(offset, offset + PASSENGER_EXPORT_MERGE_FAN_IN), output);
      next.push(output);
    }
    active = next;
    generation += 1;
  }
  return active[0];
}

async function* rowsFromJsonLines(path: string): AsyncGenerator<PassengerExportRow> {
  const reader = createInterface({ input: createReadStream(path) });
  try {
    for await (const line of reader) {
      if (line) {
        yield parseSortableRow(line);
      }
    }
  } finally {
    reader.close();
  }
}

async function downloadSourceChunks(
  ctx: ActionCtx,
  operationId: Id<"passengerExportOperations">,
  directory: string
) {
  const paths: string[] = [];
  let afterPageIndex = -1;
  let rowCount = 0;
  while (true) {
    const chunks = await ctx.runQuery(listPassengerExportSourceChunksRef, {
      afterPageIndex,
      operationId,
    });
    for (const chunk of chunks) {
      const url = await ctx.storage.getUrl(chunk.storageId);
      if (!url) {
        throw new ConvexError("Passenger export source chunk is unavailable");
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new ConvexError("Passenger export source chunk could not be read");
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > PASSENGER_EXPORT_MAX_CHUNK_BYTES) {
        throw new ConvexError("Passenger export source chunk exceeded its byte budget");
      }
      const path = join(directory, `source-${chunk.pageIndex}.jsonl`);
      await writeFile(path, new Uint8Array(buffer));
      paths.push(path);
      rowCount += chunk.rowCount;
      afterPageIndex = chunk.pageIndex;
    }
    if (chunks.length < 50) {
      return { paths, rowCount };
    }
  }
}

async function finalizePassengerExport(
  ctx: ActionCtx,
  args: PassengerExportWorkerArgs,
  operation: { jobCode?: string; rowsProcessed: number; sourceChunkCount?: number }
) {
  if (!operation.jobCode) {
    throw new ConvexError("Passenger export source identity is incomplete");
  }
  const directory = await mkdtemp(join(tmpdir(), "citius-passenger-export-"));
  let finalStorageId: Id<"_storage"> | null = null;
  try {
    const chunks = await downloadSourceChunks(ctx, args.operationId, directory);
    if (
      chunks.paths.length !== (operation.sourceChunkCount ?? 0) ||
      chunks.rowCount !== operation.rowsProcessed
    ) {
      throw new ConvexError("Passenger export source manifest is incomplete");
    }
    const mergedPath = await mergePassengerExportChunkFiles(chunks.paths, directory);
    const workbookPath = join(directory, "passenger-export.xlsx");
    const file = await writePassengerExportFile(
      args.exportKind,
      operation.jobCode,
      rowsFromJsonLines(mergedPath),
      workbookPath
    );
    if (file.rowCount !== operation.rowsProcessed) {
      throw new ConvexError("Passenger export workbook row count does not match its manifest");
    }
    finalStorageId = await ctx.storage.store(
      await openAsBlob(workbookPath, { type: WORKBOOK_MIME })
    );
    await ctx.runMutation(internal.crm.imports.stagePassengerExportArtifact, {
      fileName: file.fileName,
      leaseId: args.leaseId,
      operationId: args.operationId,
      storageId: finalStorageId,
    });
    await ctx.runMutation(internal.crm.imports.completePassengerExportOperation, {
      leaseId: args.leaseId,
      operationId: args.operationId,
      rowsProcessed: operation.rowsProcessed,
    });
    try {
      await ctx.runMutation(internal.crm.imports.logPassengerExport, {
        access: args.access,
        exportKind: args.exportKind,
        jobCardId: args.jobCardId,
        rowCount: operation.rowsProcessed,
      });
    } catch (activityError) {
      console.error("Failed to log completed passenger export:", activityError);
    }
  } catch (error) {
    if (finalStorageId) {
      await ctx.runMutation(internal.crm.imports.failPassengerExportOperation, {
        artifactDeleted: true,
        errorCode: classifyImportError(error) === "retryable" ? "retryable" : "export_failed",
        leaseId: args.leaseId,
        operationId: args.operationId,
      });
      await ctx.runMutation(internal.crm.storageReferences.deleteIfUnreferenced, {
        storageId: finalStorageId,
      });
    }
    throw error;
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

export async function continuePassengerExportAction(
  ctx: ActionCtx,
  args: PassengerExportWorkerArgs
): Promise<null> {
  let operation = await ctx.runQuery(internal.crm.imports.getPassengerExportOperation, {
    operationId: args.operationId,
  });
  if (!operation || operation.status !== "running" || operation.leaseId !== args.leaseId) {
    return null;
  }
  try {
    for (let pageCount = 0; pageCount < PASSENGER_EXPORT_PAGES_PER_WORKER; pageCount += 1) {
      if (operation.sourceDone) {
        await finalizePassengerExport(ctx, args, operation);
        return null;
      }
      const cursorStart = operation.sourceCursor ?? "";
      const page = await ctx.runQuery(getPassengerExportSourcePageRef, {
        access: args.access,
        exportKind: args.exportKind,
        jobCardId: args.jobCardId,
        paginationOpts: {
          cursor: cursorStart || null,
          maximumRowsRead: CRM_LIST_MAX_ROWS_READ,
          numItems: PASSENGER_EXPORT_SOURCE_PAGE_SIZE,
        },
      });
      const rows = page.page.map(mapPassengerExportRow).sort(passengerExportSourceOrder);
      const storageId = await ctx.storage.store(
        new Blob([serializePassengerExportChunk(rows)], { type: "application/x-ndjson" })
      );
      try {
        await ctx.runMutation(stagePassengerExportSourceChunkRef, {
          continueCursor: page.continueCursor,
          cursorStart,
          isDone: page.isDone,
          jobCode: page.jobCode,
          leaseId: args.leaseId,
          operationId: args.operationId,
          pageIndex: operation.sourceChunkCount ?? 0,
          rowCount: rows.length,
          storageId,
        });
      } catch (error) {
        await ctx.runMutation(internal.crm.storageReferences.deleteIfUnreferenced, { storageId });
        throw error;
      }
      operation = await ctx.runQuery(internal.crm.imports.getPassengerExportOperation, {
        operationId: args.operationId,
      });
      if (!operation || operation.status !== "running" || operation.leaseId !== args.leaseId) {
        return null;
      }
    }
    await ctx.scheduler.runAfter(0, continuePassengerExportRef, args);
    return null;
  } catch (error) {
    await ctx.runMutation(internal.crm.imports.failPassengerExportOperation, {
      artifactDeleted: true,
      errorCode: classifyImportError(error) === "retryable" ? "retryable" : "export_failed",
      leaseId: args.leaseId,
      operationId: args.operationId,
    });
    throw error;
  }
}
