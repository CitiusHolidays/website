import { makeFunctionReference } from "convex/server";
import type { PassengerExportKind } from "../../src/lib/portal/passengerExportContract";
import type { Id } from "../_generated/dataModel";
import type { PortalAccess } from "./lib";
import type { PassengerExportSourceRow } from "./passengerExportSourceContract";

export const continuePassengerExportRef = makeFunctionReference<
  "action",
  {
    access: PortalAccess;
    exportKind: PassengerExportKind;
    jobCardId: Id<"jobCards">;
    leaseId: string;
    operationId: Id<"passengerExportOperations">;
  },
  null
>("crm/importActions:continuePassengerExport");

export const getPassengerExportSourcePageRef = makeFunctionReference<
  "query",
  {
    access: PortalAccess;
    exportKind: PassengerExportKind;
    jobCardId: Id<"jobCards">;
    paginationOpts: { cursor: string | null; maximumRowsRead: number; numItems: number };
  },
  {
    clientName: string;
    continueCursor: string;
    isDone: boolean;
    jobCode: string;
    page: PassengerExportSourceRow[];
  }
>("crm/imports:getPassengerExportSourcePage");

export const stagePassengerExportSourceChunkRef = makeFunctionReference<
  "mutation",
  {
    continueCursor: string;
    cursorStart: string;
    isDone: boolean;
    jobCode: string;
    leaseId: string;
    operationId: Id<"passengerExportOperations">;
    pageIndex: number;
    rowCount: number;
    storageId: Id<"_storage">;
  },
  null
>("crm/passengerExportOperations:stagePassengerExportSourceChunk");

export const listPassengerExportSourceChunksRef = makeFunctionReference<
  "query",
  {
    afterPageIndex: number;
    operationId: Id<"passengerExportOperations">;
  },
  Array<{
    continueCursor: string;
    isDone: boolean;
    pageIndex: number;
    rowCount: number;
    storageId: Id<"_storage">;
  }>
>("crm/passengerExportOperations:listPassengerExportSourceChunks");

export const purgePassengerExportSourceChunksRef = makeFunctionReference<
  "mutation",
  {
    expireOperation: boolean;
    operationId: Id<"passengerExportOperations">;
  },
  { deleted: number; scheduled: boolean }
>("crm/passengerExportOperations:purgePassengerExportSourceChunks");
