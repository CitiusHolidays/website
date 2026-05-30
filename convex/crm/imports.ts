import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { canSeeJobCardRecord, createActivity, PERMISSIONS, requireStaff } from "./lib";

const foodPreferenceValidator = v.union(
  v.literal("Veg"),
  v.literal("Non-Veg"),
  v.literal("Jain"),
  v.literal("Vegan"),
);

const importKindValidator = v.union(
  v.literal("passenger"),
  v.literal("traveller"),
  v.literal("rooming"),
  v.literal("passport"),
  v.literal("visa"),
);

const visaStatusValidator = v.union(
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
);

const passengerImportRow = v.object({
  id: v.string(),
  sourceSheet: v.string(),
  sourceRowNumber: v.number(),
  importKind: v.optional(importKindValidator),
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
  hotelAllocation: v.optional(v.string()),
  visaStatus: v.optional(visaStatusValidator),
  biometricAppointmentDate: v.optional(v.string()),
  visaNotes: v.optional(v.string()),
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
  const airlines = Array.from(
    new Set(group.segments.map((segment) => segment.airline).filter(Boolean)),
  );
  return {
    name: `${group.sourceSheet} itinerary ${group.groupIndex + 1}`,
    route: [first?.origin, last?.destination].filter(Boolean).join(" - "),
    airline: airlines.length === 1 ? airlines[0] : airlines.join(" / "),
    flightNumber: group.segments
      .map((segment) => segment.flightNumber)
      .filter(Boolean)
      .join(" / "),
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
  return (
    sameJob.find((traveller: any) => traveller.fullName.trim().toLowerCase() === normalizedName) ??
    null
  );
}

function includeText(value: string | undefined) {
  return value !== undefined && value.trim() !== "";
}

function travellerPatchForImport(row: any, job: any, now: number) {
  const importKind = row.importKind ?? "passenger";
  const patch: Record<string, unknown> = {
    jobCardId: job._id,
    fullName: row.fullName.trim(),
    importSource: `${importKind}-spreadsheet`,
    importKey: row.importKey,
    sourceSheet: row.sourceSheet,
    sourceRowNumber: row.sourceRowNumber,
    updatedAt: now,
  };

  const includeSourceFields = () => {
    patch.sourceDealerCode = row.sourceDealerCode?.trim() || "";
    patch.sourceDealerName = row.sourceDealerName?.trim() || "";
    patch.sourceDescription = row.sourceDescription?.trim() || "";
    patch.sourceSoName = row.sourceSoName?.trim() || "";
    patch.sourceRsoName = row.sourceRsoName?.trim() || "";
    patch.sourceGroup = row.sourceGroup?.trim() || "";
    patch.gender = row.gender?.trim() || "";
    patch.contactNo = row.contactNo?.trim() || "";
  };

  includeSourceFields();

  if (importKind === "passenger" || importKind === "traveller") {
    patch.travelHub = row.travelHub?.trim() || "";
    patch.foodPreference = row.foodPreference;
    patch.guestType = row.guestType;
    patch.paymentType = row.paymentType;
    patch.roomType = row.roomType;
    patch.visaRequired = row.visaRequired;
    patch.domesticTravelRequired = row.domesticTravelRequired ?? false;
    patch.passportStatus = row.passportStatus?.trim() || "Pending";
    patch.specialRequests = row.specialRequests?.trim() || "";
    return patch;
  }

  if (importKind === "rooming") {
    patch.roomType = row.roomType;
    if (includeText(row.travelHub)) patch.travelHub = row.travelHub.trim();
    if (includeText(row.specialRequests)) patch.specialRequests = row.specialRequests.trim();
    if (includeText(row.hotelAllocation)) patch.hotelAllocation = row.hotelAllocation.trim();
    if (includeText(row.passportStatus)) patch.passportStatus = row.passportStatus.trim();
    return patch;
  }

  if (importKind === "passport") {
    if (includeText(row.passportStatus)) patch.passportStatus = row.passportStatus.trim();
    return patch;
  }

  if (importKind === "visa") {
    patch.visaRequired = row.visaStatus ? row.visaStatus !== "Not Required" : row.visaRequired;
    patch.visaStatus = row.visaStatus || (row.visaRequired ? "Not Started" : "Not Required");
    if (includeText(row.biometricAppointmentDate)) {
      patch.biometricAppointmentDate = row.biometricAppointmentDate.trim();
    }
    if (includeText(row.paymentType)) patch.paymentType = row.paymentType;
    if (includeText(row.passportStatus)) patch.passportStatus = row.passportStatus.trim();
  }

  return patch;
}

function travellerCreateDefaults(row: any, job: any, access: any, now: number) {
  const visaStatus = row.visaStatus || (row.visaRequired ? "Not Started" : "Not Required");
  return {
    jobCardId: job._id,
    fullName: row.fullName.trim(),
    travelHub: row.travelHub?.trim() || "",
    foodPreference: row.foodPreference,
    guestType: row.guestType,
    paymentType: row.paymentType,
    roomType: row.roomType,
    visaRequired: row.visaStatus ? row.visaStatus !== "Not Required" : row.visaRequired,
    domesticTravelRequired: row.domesticTravelRequired ?? false,
    passportStatus: row.passportStatus?.trim() || "Pending",
    specialRequests: row.specialRequests?.trim() || "",
    hotelAllocation: row.hotelAllocation?.trim() || "",
    gender: row.gender?.trim() || "",
    contactNo: row.contactNo?.trim() || "",
    importSource: `${row.importKind ?? "passenger"}-spreadsheet`,
    importKey: row.importKey,
    sourceSheet: row.sourceSheet,
    sourceRowNumber: row.sourceRowNumber,
    sourceDealerCode: row.sourceDealerCode?.trim() || "",
    sourceDealerName: row.sourceDealerName?.trim() || "",
    sourceDescription: row.sourceDescription?.trim() || "",
    sourceSoName: row.sourceSoName?.trim() || "",
    sourceRsoName: row.sourceRsoName?.trim() || "",
    sourceGroup: row.sourceGroup?.trim() || "",
    biometricAppointmentDate: row.biometricAppointmentDate?.trim() || "",
    travelDate: job.travelStartDate ?? "",
    extensionOfTour: false,
    arrivingEarly: false,
    guestCompanions: "",
    ticketStatus: "Pending Issue" as const,
    visaStatus,
    callingStatus: "Pending" as const,
    cancellation: false,
    lastMinuteDrop: false,
    createdBy: access.authUserId ?? "unknown",
    createdAt: now,
    updatedAt: now,
  };
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
      const importKind = row.importKind ?? "passenger";
      const travellerPatch = travellerPatchForImport(row, job, now);

      let travellerId: Id<"travellers">;
      let isNewTraveller = false;
      if (match) {
        const patch = { ...travellerPatch };
        if (importKind === "passenger") {
          patch.visaStatus =
            row.visaRequired && match.visaStatus === "Not Required"
              ? "Not Started"
              : row.visaRequired
                ? match.visaStatus
                : "Not Required";
        }
        await ctx.db.patch(match._id, patch);
        travellerId = match._id;
        updated += 1;
      } else {
        travellerId = await ctx.db.insert(
          "travellers",
          travellerCreateDefaults(row, job, args.access, now),
        );
        isNewTraveller = true;
        created += 1;
      }

      if (isNewTraveller || importKind === "passenger" || importKind === "visa") {
        const nextVisaStatus =
          row.visaStatus || (row.visaRequired ? "Not Started" : "Not Required");
        const visaRecords = await ctx.db
          .query("visaRecords")
          .withIndex("by_travellerId", (q: any) => q.eq("travellerId", travellerId))
          .collect();
        if (visaRecords.length === 0) {
          await ctx.db.insert("visaRecords", {
            travellerId,
            jobCardId,
            status: nextVisaStatus,
            appointmentDate: row.biometricAppointmentDate?.trim() || "",
            notes: row.visaNotes?.trim() || "",
            updatedBy: args.access.authUserId ?? "unknown",
            createdAt: now,
            updatedAt: now,
          });
        } else {
          for (const visaRecord of visaRecords) {
            const status =
              importKind === "visa"
                ? nextVisaStatus
                : row.visaRequired
                  ? visaRecord.status === "Not Required"
                    ? "Not Started"
                    : visaRecord.status
                  : "Not Required";
            await ctx.db.patch(visaRecord._id, {
              status,
              ...(importKind === "visa" && row.biometricAppointmentDate !== undefined
                ? { appointmentDate: row.biometricAppointmentDate?.trim() || "" }
                : {}),
              ...(importKind === "visa" && row.visaNotes !== undefined
                ? { notes: row.visaNotes?.trim() || "" }
                : {}),
              updatedBy: args.access.authUserId ?? "unknown",
              updatedAt: now,
            });
          }
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

    const importedKind = args.rows[0]?.importKind ?? "passenger";
    const importedLabel =
      importedKind === "passenger"
        ? "passengers"
        : importedKind === "traveller"
          ? "travellers"
          : `${importedKind} rows`;

    await createActivity(ctx, args.access, {
      entityType: "traveller",
      entityId: jobCardId,
      action: "imported",
      message: `${created + updated} ${importedLabel} imported for ${job.jobCode}`,
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
        const existingSegment = existingSegments.find(
          (entry) => entry.importKey === segment.importKey,
        );
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
      const visaRecord = await ctx.db
        .query("visaRecords")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
        .unique();

      rows.push({
        travellerId: traveller._id,
        fullName: traveller.fullName,
        travelHub: traveller.travelHub ?? "",
        foodPreference: traveller.foodPreference,
        paymentType: traveller.paymentType,
        roomType: traveller.roomType,
        visaRequired: traveller.visaRequired,
        visaStatus: traveller.visaStatus,
        hotelAllocation: traveller.hotelAllocation ?? "",
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
        visa: visaRecord
          ? {
              status: visaRecord.status,
              appointmentDate: visaRecord.appointmentDate ?? "",
              notes: visaRecord.notes ?? "",
            }
          : {
              status: traveller.visaStatus,
              appointmentDate: traveller.biometricAppointmentDate ?? "",
              notes: "",
            },
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
    exportKind: v.optional(importKindValidator),
    access: v.any(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) return;
    const job = await ctx.db.get(jobCardId);
    if (!job) return;

    const exportedKind = args.exportKind ?? "passenger";
    const exportedLabel =
      exportedKind === "passenger"
        ? "passengers"
        : exportedKind === "traveller"
          ? "travellers"
          : `${exportedKind} rows`;

    await createActivity(ctx, args.access, {
      entityType: "traveller",
      entityId: jobCardId,
      action: "exported",
      message: `${args.rowCount} ${exportedLabel} exported for ${job.jobCode}`,
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
