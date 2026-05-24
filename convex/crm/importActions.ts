"use node";

import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { PERMISSIONS } from "./lib";
import { decryptPassportDetails, encryptPassportDetails, hash } from "../lib/encryption";

const passengerImportRowInput = v.object({
  id: v.string(),
  sourceSheet: v.string(),
  sourceRowNumber: v.number(),
  sourceStatus: v.optional(v.string()),
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
  passport: v.object({
    number: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    issueDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    nationality: v.optional(v.string()),
  }),
});

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
    };
  });
}

async function requirePassengerImportAccess(ctx: any) {
  const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
  if (
    !access?.allowed ||
    !access.permissions.includes(PERMISSIONS.MANAGE_TRAVELLERS) ||
    !access.permissions.includes(PERMISSIONS.MANAGE_VISA)
  ) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
}

async function requirePassengerExportAccess(ctx: any) {
  const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
  if (
    !access?.allowed ||
    !access.permissions.includes(PERMISSIONS.VIEW_TRAVELLERS) ||
    !access.permissions.includes(PERMISSIONS.VIEW_VISA)
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
    passport,
  };
}

export const previewPassengerImport = action({
  args: {
    jobCardId: v.string(),
    rows: v.array(passengerImportRowInput),
  },
  handler: async (ctx, args): Promise<any> => {
    const access = await requirePassengerImportAccess(ctx);
    const preparedRows = preparePassengerRows(args.rows);
    return await ctx.runQuery(internal.crm.imports.previewPassengerImportRows, {
      jobCardId: args.jobCardId,
      rows: preparedRows,
      access,
    });
  },
});

export const commitPassengerImport = action({
  args: {
    jobCardId: v.string(),
    rows: v.array(passengerImportRowInput),
  },
  handler: async (ctx, args): Promise<any> => {
    const access = await requirePassengerImportAccess(ctx);
    const preparedRows = preparePassengerRows(args.rows);
    return await ctx.runMutation(internal.crm.imports.commitPassengerImportRows, {
      jobCardId: args.jobCardId,
      rows: preparedRows,
      access,
    });
  },
});

export const getPassengerExportRows = action({
  args: {
    jobCardId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    const access = await requirePassengerExportAccess(ctx);
    const source = await ctx.runQuery(internal.crm.imports.getPassengerExportSource, {
      jobCardId: args.jobCardId,
      access,
    });
    const rows = source.rows.map(mapPassengerExportRow);

    await ctx.runMutation(internal.crm.imports.logPassengerExport, {
      jobCardId: args.jobCardId,
      rowCount: rows.length,
      access,
    });

    return {
      jobCode: source.jobCode,
      clientName: source.clientName,
      rows,
    };
  },
});
