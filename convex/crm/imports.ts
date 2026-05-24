import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  PERMISSIONS,
  canSeeJobCardRecord,
  createActivity,
  requireStaff,
} from "./lib";

const foodPreferenceValidator = v.union(
  v.literal("Veg"),
  v.literal("Non-Veg"),
  v.literal("Jain"),
  v.literal("Vegan"),
);

const passengerImportRow = v.object({
  id: v.string(),
  sourceSheet: v.string(),
  sourceRowNumber: v.number(),
  importKey: v.string(),
  fullName: v.string(),
  travelHub: v.optional(v.string()),
  foodPreference: foodPreferenceValidator,
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
  passportNumberHash: v.optional(v.string()),
  encryptedPassportPayload: v.optional(v.string()),
  passportLastFour: v.optional(v.string()),
});

const flightSegmentInput = v.object({
  id: v.string(),
  sourceSheet: v.string(),
  sourceRowNumber: v.optional(v.number()),
  sourceGroupIndex: v.number(),
  segmentIndex: v.number(),
  importKey: v.string(),
  dateLabel: v.string(),
  airline: v.string(),
  flightNumber: v.string(),
  departTime: v.optional(v.string()),
  origin: v.string(),
  arriveTime: v.optional(v.string()),
  destination: v.string(),
  duration: v.optional(v.string()),
  transit: v.optional(v.string()),
});

const flightGroupInput = v.object({
  id: v.string(),
  sourceSheet: v.string(),
  groupIndex: v.number(),
  name: v.string(),
  segments: v.array(flightSegmentInput),
});

async function getVisibleJob(ctx: any, access: any, jobCardId: Id<"jobCards">) {
  const job = await ctx.db.get(jobCardId);
  const linkedQuery = job?.queryId ? await ctx.db.get(job.queryId) : null;
  if (!job || !canSeeJobCardRecord(access, job, linkedQuery)) {
    return null;
  }
  return job;
}

function groupImportKey(sheet: string, groupIndex: number) {
  return `${sheet.trim().toLowerCase()}|${groupIndex}`;
}

function summarizeGroup(group: {
  sourceSheet: string;
  groupIndex: number;
  segments: Array<{
    airline: string;
    flightNumber: string;
    dateLabel: string;
    origin: string;
    destination: string;
  }>;
}) {
  const first = group.segments[0];
  const last = group.segments[group.segments.length - 1] ?? first;
  const airlines = Array.from(new Set(group.segments.map((segment) => segment.airline).filter(Boolean)));
  return {
    name: `${group.sourceSheet} itinerary ${group.groupIndex + 1}`,
    route: [first?.origin, last?.destination].filter(Boolean).join(" - "),
    airline: airlines.length === 1 ? airlines[0] : airlines.join(" / "),
    flightNumber: group.segments.map((segment) => segment.flightNumber).filter(Boolean).join(" / "),
    departureDate: first?.dateLabel ?? "",
    arrivalDate: last?.dateLabel ?? "",
  };
}

async function findTravellerMatch(ctx: any, jobCardId: Id<"jobCards">, row: any) {
  if (row.passportNumberHash) {
    const passportRows = await ctx.db
      .query("passportDetails")
      .withIndex("by_passportNumberHash", (q: any) =>
        q.eq("passportNumberHash", row.passportNumberHash),
      )
      .collect();
    for (const passport of passportRows) {
      const traveller = await ctx.db.get(passport.travellerId);
      if (traveller?.jobCardId === jobCardId) {
        return traveller;
      }
    }
  }

  if (row.importKey) {
    const byImportKey = await ctx.db
      .query("travellers")
      .withIndex("by_jobCardId_importKey", (q: any) =>
        q.eq("jobCardId", jobCardId).eq("importKey", row.importKey),
      )
      .first();
    if (byImportKey) return byImportKey;
  }

  const normalizedName = row.fullName.trim().toLowerCase();
  const sameJob = await ctx.db
    .query("travellers")
    .withIndex("by_jobCardId", (q: any) => q.eq("jobCardId", jobCardId))
    .collect();
  return sameJob.find((traveller: any) => traveller.fullName.trim().toLowerCase() === normalizedName) ?? null;
}

export const previewPassengerImportRows = internalQuery({
  args: {
    jobCardId: v.string(),
    rows: v.array(passengerImportRow),
    access: v.any(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) throw new ConvexError("FORBIDDEN");

    const results = [];
    for (const row of args.rows) {
      const match = await findTravellerMatch(ctx, jobCardId, row);
      results.push({
        id: row.id,
        action: match ? "update" : "create",
        travellerId: match?._id ?? null,
        travellerName: match?.fullName ?? "",
      });
    }
    return { rows: results };
  },
});

export const commitPassengerImportRows = internalMutation({
  args: {
    jobCardId: v.string(),
    rows: v.array(passengerImportRow),
    access: v.any(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) throw new ConvexError("FORBIDDEN");

    let created = 0;
    let updated = 0;
    const now = Date.now();

    for (const row of args.rows) {
      const match = await findTravellerMatch(ctx, jobCardId, row);
      const visaStatus = row.visaRequired ? "Not Started" : "Not Required";
      const travellerPatch = {
        jobCardId,
        fullName: row.fullName.trim(),
        travelHub: row.travelHub?.trim() || "",
        foodPreference: row.foodPreference,
        guestType: row.guestType,
        paymentType: row.paymentType,
        roomType: row.roomType,
        visaRequired: row.visaRequired,
        domesticTravelRequired: row.domesticTravelRequired ?? false,
        passportStatus: row.passportStatus?.trim() || "Pending",
        specialRequests: row.specialRequests?.trim() || "",
        gender: row.gender?.trim() || "",
        contactNo: row.contactNo?.trim() || "",
        importSource: "passenger-spreadsheet",
        importKey: row.importKey,
        sourceSheet: row.sourceSheet,
        sourceRowNumber: row.sourceRowNumber,
        sourceDealerCode: row.sourceDealerCode?.trim() || "",
        sourceDealerName: row.sourceDealerName?.trim() || "",
        sourceDescription: row.sourceDescription?.trim() || "",
        sourceSoName: row.sourceSoName?.trim() || "",
        sourceRsoName: row.sourceRsoName?.trim() || "",
        sourceGroup: row.sourceGroup?.trim() || "",
        updatedAt: now,
      };

      let travellerId: Id<"travellers">;
      if (match) {
        await ctx.db.patch(match._id, {
          ...travellerPatch,
          visaStatus:
            row.visaRequired && match.visaStatus === "Not Required"
              ? "Not Started"
              : row.visaRequired
                ? match.visaStatus
                : "Not Required",
        });
        travellerId = match._id;
        updated += 1;
      } else {
        travellerId = await ctx.db.insert("travellers", {
          ...travellerPatch,
          biometricAppointmentDate: "",
          travelDate: job.travelStartDate ?? "",
          extensionOfTour: false,
          arrivingEarly: false,
          guestCompanions: "",
          hotelAllocation: "",
          ticketStatus: "Pending Issue",
          visaStatus,
          callingStatus: "Pending",
          cancellation: false,
          lastMinuteDrop: false,
          createdBy: args.access.authUserId ?? "unknown",
          createdAt: now,
        });
        created += 1;
      }

      const visaRecords = await ctx.db
        .query("visaRecords")
        .withIndex("by_travellerId", (q: any) => q.eq("travellerId", travellerId))
        .collect();
      if (visaRecords.length === 0) {
        await ctx.db.insert("visaRecords", {
          travellerId,
          jobCardId,
          status: row.visaRequired ? "Not Started" : "Not Required",
          updatedBy: args.access.authUserId ?? "unknown",
          createdAt: now,
          updatedAt: now,
        });
      } else {
        for (const visaRecord of visaRecords) {
          await ctx.db.patch(visaRecord._id, {
            status: row.visaRequired ? visaRecord.status === "Not Required" ? "Not Started" : visaRecord.status : "Not Required",
            updatedBy: args.access.authUserId ?? "unknown",
            updatedAt: now,
          });
        }
      }

      if (row.encryptedPassportPayload) {
        const existingPassport = await ctx.db
          .query("passportDetails")
          .withIndex("by_travellerId", (q: any) => q.eq("travellerId", travellerId))
          .unique();
        if (existingPassport) {
          await ctx.db.patch(existingPassport._id, {
            encryptedPayload: row.encryptedPassportPayload,
            lastFour: row.passportLastFour,
            passportNumberHash: row.passportNumberHash,
            status: "Received",
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("passportDetails", {
            travellerId,
            encryptedPayload: row.encryptedPassportPayload,
            lastFour: row.passportLastFour,
            passportNumberHash: row.passportNumberHash,
            status: "Received",
            createdBy: args.access.authUserId ?? "unknown",
            createdAt: now,
            updatedAt: now,
          });
        }
        await ctx.db.patch(travellerId, {
          passportStatus: "Received",
          updatedAt: now,
        });
      }
    }

    await createActivity(ctx, args.access, {
      entityType: "traveller",
      entityId: jobCardId,
      action: "imported",
      message: `${created + updated} passengers imported for ${job.jobCode}`,
    });

    return { created, updated, total: args.rows.length };
  },
});

export const commitFlightImport = mutation({
  args: {
    jobCardId: v.string(),
    groups: v.array(flightGroupInput),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const job = await getVisibleJob(ctx, access, jobCardId);
    if (!job) throw new ConvexError("FORBIDDEN");

    const now = Date.now();
    let createdGroups = 0;
    let updatedGroups = 0;
    let createdSegments = 0;
    let updatedSegments = 0;

    for (const group of args.groups) {
      const importKey = groupImportKey(group.sourceSheet, group.groupIndex);
      const summary = summarizeGroup(group);
      const existingGroup = await ctx.db
        .query("flightGroups")
        .withIndex("by_jobCardId_importKey", (q) =>
          q.eq("jobCardId", jobCardId).eq("importKey", importKey),
        )
        .first();

      let flightGroupId: Id<"flightGroups">;
      const groupPatch = {
        name: group.name.trim() || summary.name,
        route: summary.route,
        airline: summary.airline,
        flightNumber: summary.flightNumber,
        departureDate: summary.departureDate,
        arrivalDate: summary.arrivalDate,
        ticketingType: "Imported Itinerary",
        totalSeats: 0,
        importKey,
        sourceSheet: group.sourceSheet,
        sourceGroupIndex: group.groupIndex,
        updatedAt: now,
      };

      if (existingGroup) {
        await ctx.db.patch(existingGroup._id, groupPatch);
        flightGroupId = existingGroup._id;
        updatedGroups += 1;
      } else {
        flightGroupId = await ctx.db.insert("flightGroups", {
          jobCardId,
          ...groupPatch,
          createdBy: access.authUserId ?? "unknown",
          createdAt: now,
        });
        createdGroups += 1;
      }

      const incomingKeys = new Set(group.segments.map((segment) => segment.importKey));
      const existingSegments = await ctx.db
        .query("flightSegments")
        .withIndex("by_flightGroupId", (q) => q.eq("flightGroupId", flightGroupId))
        .collect();
      for (const existingSegment of existingSegments) {
        if (!incomingKeys.has(existingSegment.importKey)) {
          await ctx.db.delete(existingSegment._id);
        }
      }

      for (const segment of group.segments) {
        const existingSegment = existingSegments.find((entry) => entry.importKey === segment.importKey);
        const segmentPatch = {
          jobCardId,
          flightGroupId,
          importKey: segment.importKey,
          sourceSheet: segment.sourceSheet,
          sourceRowNumber: segment.sourceRowNumber,
          sourceGroupIndex: segment.sourceGroupIndex,
          segmentIndex: segment.segmentIndex,
          dateLabel: segment.dateLabel,
          airline: segment.airline,
          flightNumber: segment.flightNumber,
          departTime: segment.departTime ?? "",
          origin: segment.origin,
          arriveTime: segment.arriveTime ?? "",
          destination: segment.destination,
          duration: segment.duration ?? "",
          transit: segment.transit ?? "",
          updatedAt: now,
        };
        if (existingSegment) {
          await ctx.db.patch(existingSegment._id, segmentPatch);
          updatedSegments += 1;
        } else {
          await ctx.db.insert("flightSegments", {
            ...segmentPatch,
            createdBy: access.authUserId ?? "unknown",
            createdAt: now,
          });
          createdSegments += 1;
        }
      }
    }

    await createActivity(ctx, access, {
      entityType: "flightGroup",
      entityId: jobCardId,
      action: "imported",
      message: `${createdSegments + updatedSegments} flight segments imported for ${job.jobCode}`,
    });

    return {
      createdGroups,
      updatedGroups,
      createdSegments,
      updatedSegments,
      totalGroups: args.groups.length,
      totalSegments: args.groups.reduce((sum, group) => sum + group.segments.length, 0),
    };
  },
});

export const getPassengerExportSource = internalQuery({
  args: {
    jobCardId: v.string(),
    access: v.any(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) throw new ConvexError("FORBIDDEN");

    const travellers = await ctx.db
      .query("travellers")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
      .collect();

    const rows = [];
    for (const traveller of travellers.sort((a, b) => a.fullName.localeCompare(b.fullName))) {
      const passport = await ctx.db
        .query("passportDetails")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
        .unique();

      rows.push({
        travellerId: traveller._id,
        fullName: traveller.fullName,
        travelHub: traveller.travelHub ?? "",
        foodPreference: traveller.foodPreference,
        gender: traveller.gender ?? "",
        contactNo: traveller.contactNo ?? "",
        specialRequests: traveller.specialRequests ?? "",
        sourceDealerCode: traveller.sourceDealerCode ?? "",
        sourceDealerName: traveller.sourceDealerName ?? "",
        sourceDescription: traveller.sourceDescription ?? "",
        sourceSoName: traveller.sourceSoName ?? "",
        sourceRsoName: traveller.sourceRsoName ?? "",
        sourceGroup: traveller.sourceGroup ?? "",
        cancellation: traveller.cancellation ?? false,
        lastMinuteDrop: traveller.lastMinuteDrop ?? false,
        encryptedPassportPayload: passport?.encryptedPayload ?? "",
      });
    }

    return {
      jobCode: job.jobCode,
      clientName: job.clientName,
      rows,
    };
  },
});

export const logPassengerExport = internalMutation({
  args: {
    jobCardId: v.string(),
    rowCount: v.number(),
    access: v.any(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) return;
    const job = await ctx.db.get(jobCardId);
    if (!job) return;

    await createActivity(ctx, args.access, {
      entityType: "traveller",
      entityId: jobCardId,
      action: "exported",
      message: `${args.rowCount} passengers exported for ${job.jobCode}`,
    });
  },
});

export const listFlightItinerary = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
    const groups = await ctx.db.query("flightGroups").collect();
    const result = [];
    for (const group of groups.sort((a, b) => b.updatedAt - a.updatedAt)) {
      const job = await getVisibleJob(ctx, access, group.jobCardId);
      if (!job) continue;
      const segments = await ctx.db
        .query("flightSegments")
        .withIndex("by_flightGroupId", (q) => q.eq("flightGroupId", group._id))
        .collect();
      result.push({
        id: group._id,
        jobCardId: group.jobCardId,
        jobCode: job.jobCode,
        clientName: job.clientName,
        name: group.name,
        route: group.route,
        airline: group.airline,
        departureDate: group.departureDate,
        arrivalDate: group.arrivalDate ?? "",
        sourceSheet: group.sourceSheet ?? "",
        sourceGroupIndex: group.sourceGroupIndex ?? 0,
        importKey: group.importKey ?? "",
        segments: segments
          .sort((a, b) => a.segmentIndex - b.segmentIndex)
          .map((segment) => ({
            id: segment._id,
            importKey: segment.importKey,
            dateLabel: segment.dateLabel,
            airline: segment.airline,
            flightNumber: segment.flightNumber,
            departTime: segment.departTime ?? "",
            origin: segment.origin,
            arriveTime: segment.arriveTime ?? "",
            destination: segment.destination,
            duration: segment.duration ?? "",
            transit: segment.transit ?? "",
          })),
        updatedAt: new Date(group.updatedAt).toISOString(),
      });
    }
    return result;
  },
});
