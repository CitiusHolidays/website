"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import { decryptPassportDetails } from "../lib/encryption";
import {
  chunkRows,
  exportKindValidator,
  IMPORT_BATCH_SIZE,
  mergeRoomSummaries,
  preparePassengerRows,
  publicPassengerImportRow,
} from "./importRows";
import { PERMISSIONS } from "./lib";
import { cleanPassportField } from "./passportExpiry";

function clean(value?: string) {
  return String(value ?? "").trim();
}

function hasPermission(access: any, permission: string) {
  return access?.permissions?.includes(permission);
}

function hasAllPermissions(access: any, permissions: string[]) {
  return permissions.every((permission) => hasPermission(access, permission));
}

async function requireImportAccess(ctx: any, rows: Array<any>) {
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
    const access = await requireImportAccess(ctx, args.rows);
    const preparedRows = preparePassengerRows(args.rows);
    const batches = chunkRows(preparedRows, IMPORT_BATCH_SIZE);
    let mergedRows: Array<any> = [];
    let roomSummary: Record<string, number> = {};

    const batchResults = await Promise.all(
      batches.map((batch) =>
        ctx.runQuery(internal.crm.imports.previewPassengerImportRows, {
          access,
          jobCardId: args.jobCardId,
          rows: batch,
        })
      )
    );
    for (const result of batchResults) {
      mergedRows = mergedRows.concat(result.rows);
      roomSummary = mergeRoomSummaries(roomSummary, result.roomSummary ?? {});
    }

    return { roomSummary, rows: mergedRows };
  },
});

export const commitPassengerImport = action({
  args: {
    jobCardId: v.string(),
    rows: v.array(publicPassengerImportRow),
  },
  handler: async (ctx, args): Promise<any> => {
    const access = await requireImportAccess(ctx, args.rows);
    const preparedRows = preparePassengerRows(args.rows);
    const batches = chunkRows(preparedRows, IMPORT_BATCH_SIZE);
    let created = 0;
    let updated = 0;
    let failed = 0;
    let roomSummary: Record<string, number> = {};

    const batchResults = await Promise.all(
      batches.map((batch, index) =>
        ctx.runMutation(internal.crm.imports.commitPassengerImportBatch, {
          access,
          jobCardId: args.jobCardId,
          logActivity: index === batches.length - 1,
          rows: batch,
        })
      )
    );
    for (const result of batchResults) {
      created += result.created;
      updated += result.updated;
      failed += result.failed ?? 0;
      roomSummary = mergeRoomSummaries(roomSummary, result.roomSummary ?? {});
    }

    return {
      created,
      failed,
      roomSummary,
      total: preparedRows.length,
      updated,
    };
  },
});

export const getPassengerExportRows = action({
  args: {
    exportKind: v.optional(exportKindValidator),
    jobCardId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    const access = await requireExportAccess(ctx, args.exportKind ?? "passenger");
    const source = await ctx.runQuery(internal.crm.imports.getPassengerExportSource, {
      access,
      jobCardId: args.jobCardId,
    });
    const rows = source.rows.map(mapPassengerExportRow);

    await ctx.runMutation(internal.crm.imports.logPassengerExport, {
      access,
      exportKind: args.exportKind ?? "passenger",
      jobCardId: args.jobCardId,
      rowCount: rows.length,
    });

    return {
      clientName: source.clientName,
      jobCode: source.jobCode,
      rows,
    };
  },
});
