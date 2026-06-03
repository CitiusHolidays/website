"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import { decryptPassportDetails, encryptPassportDetails, hash } from "../lib/encryption";
import { PERMISSIONS } from "./lib";
import { normalizePassportExpiryDate } from "./passportExpiry";

export const IMPORT_BATCH_SIZE = 50;

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function mergeRoomSummaries(
  left: Record<string, number>,
  right: Record<string, number>,
): Record<string, number> {
  const merged = { ...left };
  for (const [roomType, count] of Object.entries(right)) {
    merged[roomType] = (merged[roomType] ?? 0) + count;
  }
  return merged;
}

const passengerImportRowInput = v.object({
  id: v.string(),
  sourceSheet: v.string(),
  sourceRowNumber: v.number(),
  sourceStatus: v.optional(v.string()),
  importKind: v.optional(
    v.union(
      v.literal("passenger"),
      v.literal("traveller"),
      v.literal("rooming"),
      v.literal("passport"),
      v.literal("visa"),
    ),
  ),
  importKey: v.string(),
  fullName: v.string(),
  travelHub: v.optional(v.string()),
  foodPreference: v.union(
    v.literal("Veg"),
    v.literal("Non-Veg"),
    v.literal("Jain"),
    v.literal("Vegan"),
  ),
  guestType: v.union(v.literal("Employee"), v.literal("Client"), v.literal("VIP")),
  paymentType: v.union(
    v.literal("Company Paid"),
    v.literal("Self Paid"),
    v.literal("Upgraded Self Paid"),
  ),
  roomType: v.union(
    v.literal("SGL"),
    v.literal("Twin"),
    v.literal("DBL"),
    v.literal("Child with Bed"),
    v.literal("Family Room"),
  ),
  visaRequired: v.boolean(),
  domesticTravelRequired: v.optional(v.boolean()),
  passportStatus: v.optional(v.string()),
  specialRequests: v.optional(v.string()),
  sourceDealerCode: v.optional(v.string()),
  sourceDealerName: v.optional(v.string()),
  sourceDescription: v.optional(v.string()),
  sourceSoName: v.optional(v.string()),
  sourceRsoName: v.optional(v.string()),
  sourceGroup: v.optional(v.string()),
  gender: v.optional(v.string()),
  contactNo: v.optional(v.string()),
  hotelAllocation: v.optional(v.string()),
  visaStatus: v.optional(
    v.union(
      v.literal("Not Required"),
      v.literal("Not Started"),
      v.literal("Checklist Shared"),
      v.literal("Documents Pending"),
      v.literal("Documents Verified"),
      v.literal("Appointment Scheduled"),
      v.literal("Submitted"),
      v.literal("Awaiting"),
      v.literal("Approved"),
      v.literal("Rejected"),
      v.literal("Re-applied"),
    ),
  ),
  biometricAppointmentDate: v.optional(v.string()),
  visaNotes: v.optional(v.string()),
  passport: v.object({
    number: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    issueDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    nationality: v.optional(v.string()),
  }),
  ticketing: v.optional(
    v.object({
      internationalFare: v.optional(v.string()),
      internationalPnr: v.optional(v.string()),
      internationalVendor: v.optional(v.string()),
      domesticTicket: v.optional(v.string()),
      domesticPnr: v.optional(v.string()),
      domesticVendor: v.optional(v.string()),
    }),
  ),
});

const exportKindValidator = v.union(
  v.literal("passenger"),
  v.literal("traveller"),
  v.literal("rooming"),
  v.literal("passport"),
  v.literal("visa"),
);

function clean(value?: string) {
  return String(value ?? "").trim();
}

function preparePassengerRows(rows: Array<any>) {
  return rows.map((row) => {
    const { passport, ...rest } = row;
    const passportNumber = clean(row.passport?.number);
    const passportNumberHash = passportNumber ? hash(passportNumber.toUpperCase()) : undefined;
    const hasPassportDetails = Boolean(
      passportNumber ||
        clean(row.passport?.dateOfBirth) ||
        clean(row.passport?.issueDate) ||
        clean(row.passport?.expiryDate),
    );

    return {
      ...rest,
      passportNumberHash,
      encryptedPassportPayload: hasPassportDetails
        ? encryptPassportDetails({
            number: passportNumber || "UNKNOWN",
            dateOfBirth: clean(row.passport?.dateOfBirth) || "UNKNOWN",
            issueDate: clean(row.passport?.issueDate),
            expiryDate: clean(row.passport?.expiryDate) || "UNKNOWN",
            nationality: clean(row.passport?.nationality) || "UNKNOWN",
          })
        : undefined,
      passportLastFour: passportNumber ? passportNumber.slice(-4) : undefined,
      passportExpiryDate: normalizePassportExpiryDate(clean(row.passport?.expiryDate)),
    };
  });
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

function exportPassportField(value?: string) {
  const text = clean(value);
  return text && text !== "UNKNOWN" ? text : "";
}

function mapPassengerExportRow(row: any) {
  let passport = {
    number: "",
    dateOfBirth: "",
    issueDate: "",
    expiryDate: "",
  };

  if (row.encryptedPassportPayload) {
    try {
      const decrypted = decryptPassportDetails(row.encryptedPassportPayload);
      passport = {
        number: exportPassportField(decrypted.number),
        dateOfBirth: exportPassportField(decrypted.dateOfBirth),
        issueDate: exportPassportField(decrypted.issueDate),
        expiryDate: exportPassportField(decrypted.expiryDate),
      };
    } catch {
      passport = { number: "", dateOfBirth: "", issueDate: "", expiryDate: "" };
    }
  }

  return {
    fullName: row.fullName,
    travelHub: row.travelHub,
    foodPreference: row.foodPreference,
    paymentType: row.paymentType,
    roomType: row.roomType,
    visaRequired: row.visaRequired,
    visaStatus: row.visaStatus,
    hotelAllocation: row.hotelAllocation,
    gender: row.gender,
    contactNo: row.contactNo,
    specialRequests: row.specialRequests,
    sourceDealerCode: row.sourceDealerCode,
    sourceDealerName: row.sourceDealerName,
    sourceDescription: row.sourceDescription,
    sourceSoName: row.sourceSoName,
    sourceRsoName: row.sourceRsoName,
    sourceGroup: row.sourceGroup,
    willingToGo: row.cancellation || row.lastMinuteDrop ? "UNABLE TO GO" : "CONFIRMED",
    ticketing: buildTicketingExport(row.tickets ?? []),
    passport,
    visa: row.visa ?? {
      status: row.visaStatus,
      appointmentDate: "",
      notes: "",
    },
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
      if (text) set.add(text);
      return set;
    }, new Set<string>()),
  ).join(" / ");
}

function buildTicketingExport(tickets: any[]) {
  const domestic = tickets.filter(isDomesticTicket);
  const international = tickets.filter((ticket) => !isDomesticTicket(ticket));

  return {
    internationalFare: "",
    internationalPnr: joinUnique(international.map((ticket) => ticket.pnrCode)),
    internationalVendor: "",
    domesticTicket: joinUnique(domestic.map((ticket) => ticket.ticketNumber)),
    domesticPnr: joinUnique(domestic.map((ticket) => ticket.pnrCode)),
    domesticVendor: "",
  };
}

export const previewPassengerImport = action({
  args: {
    jobCardId: v.string(),
    rows: v.array(passengerImportRowInput),
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
          jobCardId: args.jobCardId,
          rows: batch,
          access,
        }),
      ),
    );
    for (const result of batchResults) {
      mergedRows = mergedRows.concat(result.rows);
      roomSummary = mergeRoomSummaries(roomSummary, result.roomSummary ?? {});
    }

    return { rows: mergedRows, roomSummary };
  },
});

export const commitPassengerImport = action({
  args: {
    jobCardId: v.string(),
    rows: v.array(passengerImportRowInput),
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
          jobCardId: args.jobCardId,
          rows: batch,
          access,
          logActivity: index === batches.length - 1,
        }),
      ),
    );
    for (const result of batchResults) {
      created += result.created;
      updated += result.updated;
      failed += result.failed ?? 0;
      roomSummary = mergeRoomSummaries(roomSummary, result.roomSummary ?? {});
    }

    return {
      created,
      updated,
      total: preparedRows.length,
      failed,
      roomSummary,
    };
  },
});

export const getPassengerExportRows = action({
  args: {
    jobCardId: v.string(),
    exportKind: v.optional(exportKindValidator),
  },
  handler: async (ctx, args): Promise<any> => {
    const access = await requireExportAccess(ctx, args.exportKind ?? "passenger");
    const source = await ctx.runQuery(internal.crm.imports.getPassengerExportSource, {
      jobCardId: args.jobCardId,
      access,
    });
    const rows = source.rows.map(mapPassengerExportRow);

    await ctx.runMutation(internal.crm.imports.logPassengerExport, {
      jobCardId: args.jobCardId,
      rowCount: rows.length,
      exportKind: args.exportKind ?? "passenger",
      access,
    });

    return {
      jobCode: source.jobCode,
      clientName: source.clientName,
      rows,
    };
  },
});
