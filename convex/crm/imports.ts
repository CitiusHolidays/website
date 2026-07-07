import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import {
  buildTravellerMatchIndex,
  findTravellerMatchInIndex,
  getVisibleJob,
  processImportRows,
  resolveImportTravelBatchId,
  summarizeRoomTypesFromRows,
} from "./importProcessor";
import { exportKindValidator, internalPassengerImportRow } from "./importRowValidators";
import { createActivity, PERMISSIONS, type PortalAccess, requireStaff } from "./lib";

const flightSegmentInput = v.object({
  airline: v.string(),
  arriveTime: v.optional(v.string()),
  dateLabel: v.string(),
  departTime: v.optional(v.string()),
  destination: v.string(),
  duration: v.optional(v.string()),
  flightNumber: v.string(),
  id: v.string(),
  importKey: v.string(),
  origin: v.string(),
  segmentIndex: v.number(),
  sourceGroupIndex: v.number(),
  sourceRowNumber: v.optional(v.number()),
  sourceSheet: v.string(),
  transit: v.optional(v.string()),
});

const flightGroupInput = v.object({
  groupIndex: v.number(),
  id: v.string(),
  name: v.string(),
  segments: v.array(flightSegmentInput),
  sourceSheet: v.string(),
  travelBatchId: v.optional(v.string()),
  travelBatchReference: v.optional(v.string()),
});

type CommitFlightImportArgs = {
  jobCardId: string;
  groups: Array<{
    id?: string;
    sourceSheet: string;
    groupIndex: number;
    name: string;
    travelBatchId?: string;
    travelBatchReference?: string;
    segments: Array<{
      id?: string;
      sourceSheet?: string;
      sourceRowNumber?: number;
      sourceGroupIndex?: number;
      segmentIndex?: number;
      importKey?: string;
      dateLabel: string;
      airline: string;
      flightNumber: string;
      departTime?: string;
      origin: string;
      arriveTime?: string;
      destination: string;
      duration?: string;
      transit?: string;
    }>;
  }>;
};

function travellerExportOrder(a: any, b: any) {
  const aImported = typeof a.sourceRowNumber === "number";
  const bImported = typeof b.sourceRowNumber === "number";
  if (aImported !== bImported) {
    return aImported ? -1 : 1;
  }
  if (aImported && bImported) {
    const sheetCompare = String(a.sourceSheet ?? "").localeCompare(String(b.sourceSheet ?? ""));
    if (sheetCompare !== 0) {
      return sheetCompare;
    }
    if (a.sourceRowNumber !== b.sourceRowNumber) {
      return a.sourceRowNumber - b.sourceRowNumber;
    }
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt - b.createdAt;
  }
  return a.fullName.localeCompare(b.fullName);
}

function groupImportKey(sheet: string, groupIndex: number) {
  return `${sheet.trim().toLowerCase()}|${groupIndex}`;
}

function flightSegmentImportKey(
  group: { sourceSheet: string; groupIndex: number },
  segment: CommitFlightImportArgs["groups"][number]["segments"][number]
) {
  if (segment.importKey) {
    return segment.importKey;
  }
  const segmentIndex = segment.segmentIndex ?? 0;
  return `${groupImportKey(group.sourceSheet, group.groupIndex)}|${segmentIndex}`;
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
    group.segments.reduce((set, segment) => {
      if (segment.airline) {
        set.add(segment.airline);
      }
      return set;
    }, new Set<string>())
  );
  const flightNumbers = group.segments.reduce((items, segment) => {
    if (segment.flightNumber) {
      items.push(segment.flightNumber);
    }
    return items;
  }, [] as string[]);
  return {
    airline: airlines.length === 1 ? airlines[0] : airlines.join(" / "),
    arrivalDate: last?.dateLabel ?? "",
    departureDate: first?.dateLabel ?? "",
    flightNumber: flightNumbers.join(" / "),
    name: `${group.sourceSheet} itinerary ${group.groupIndex + 1}`,
    route: [first?.origin, last?.destination].filter(Boolean).join(" - "),
  };
}

export const previewPassengerImportRows = internalQuery({
  args: {
    access: v.any(),
    jobCardId: v.string(),
    rows: v.array(internalPassengerImportRow),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) {
      throw new ConvexError("FORBIDDEN");
    }

    const matchIndex = await buildTravellerMatchIndex(ctx, jobCardId);
    const results = args.rows.map((row) => {
      const match = findTravellerMatchInIndex(matchIndex, row);
      return {
        action: match ? "update" : "create",
        id: row.id,
        travellerId: match?._id ?? null,
        travellerName: match?.fullName ?? "",
      };
    });
    return { roomSummary: summarizeRoomTypesFromRows(args.rows), rows: results };
  },
});

export const commitPassengerImportBatch = internalMutation({
  args: {
    access: v.any(),
    jobCardId: v.string(),
    logActivity: v.optional(v.boolean()),
    rows: v.array(internalPassengerImportRow),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) {
      throw new ConvexError("FORBIDDEN");
    }

    const matchIndex = await buildTravellerMatchIndex(ctx, jobCardId);
    return await processImportRows(ctx, {
      access: args.access,
      job,
      jobCardId,
      logActivity: args.logActivity ?? false,
      matchIndex,
      rows: args.rows,
    });
  },
});

export const commitPassengerImportRows = internalMutation({
  args: {
    access: v.any(),
    jobCardId: v.string(),
    rows: v.array(internalPassengerImportRow),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) {
      throw new ConvexError("FORBIDDEN");
    }

    const matchIndex = await buildTravellerMatchIndex(ctx, jobCardId);
    return await processImportRows(ctx, {
      access: args.access,
      job,
      jobCardId,
      logActivity: true,
      matchIndex,
      rows: args.rows,
    });
  },
});

export async function commitFlightImportForTest(
  ctx: MutationCtx,
  args: CommitFlightImportArgs,
  access: PortalAccess
) {
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await getVisibleJob(ctx, access, jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }

  const now = Date.now();
  let createdGroups = 0;
  let updatedGroups = 0;
  let createdSegments = 0;
  let updatedSegments = 0;

  for (const group of args.groups) {
    const importKey = groupImportKey(group.sourceSheet, group.groupIndex);
    const summary = summarizeGroup(group);
    const travelBatchId = await resolveImportTravelBatchId(ctx, jobCardId, group);
    const existingGroup = await ctx.db
      .query("flightGroups")
      .withIndex("by_jobCardId_importKey", (q) =>
        q.eq("jobCardId", jobCardId).eq("importKey", importKey)
      )
      .first();

    let flightGroupId: Id<"flightGroups">;
    const groupFields = {
      airline: summary.airline,
      arrivalDate: summary.arrivalDate,
      departureDate: summary.departureDate,
      flightNumber: summary.flightNumber,
      importKey,
      name: group.name.trim() || summary.name,
      route: summary.route,
      sourceGroupIndex: group.groupIndex,
      sourceSheet: group.sourceSheet,
      ticketingType: "Imported Itinerary",
      totalSeats: 0,
      travelBatchId,
      updatedAt: now,
    };

    if (existingGroup) {
      await ctx.db.patch(existingGroup._id, groupFields);
      flightGroupId = existingGroup._id;
      updatedGroups += 1;
    } else {
      flightGroupId = await ctx.db.insert("flightGroups", {
        jobCardId,
        ...groupFields,
        createdAt: now,
        createdBy: access.authUserId ?? "unknown",
      });
      createdGroups += 1;
    }

    const incomingKeys = new Set(
      group.segments.map((segment) => flightSegmentImportKey(group, segment))
    );
    const existingSegments = await ctx.db
      .query("flightSegments")
      .withIndex("by_flightGroupId", (q) => q.eq("flightGroupId", flightGroupId))
      .collect();
    const existingSegmentByImportKey = new Map<string, Doc<"flightSegments">>(
      existingSegments.map((segment) => [segment.importKey, segment])
    );
    await Promise.all(
      existingSegments.flatMap((existingSegment) =>
        incomingKeys.has(existingSegment.importKey) ? [] : [ctx.db.delete(existingSegment._id)]
      )
    );

    const segmentResults = await Promise.all(
      group.segments.map(async (segment) => {
        const segmentImportKey = flightSegmentImportKey(group, segment);
        const existingSegment = existingSegmentByImportKey.get(segmentImportKey);
        const segmentPatch = {
          airline: segment.airline,
          arriveTime: segment.arriveTime ?? "",
          dateLabel: segment.dateLabel,
          departTime: segment.departTime ?? "",
          destination: segment.destination,
          duration: segment.duration ?? "",
          flightGroupId,
          flightNumber: segment.flightNumber,
          importKey: segmentImportKey,
          jobCardId,
          origin: segment.origin,
          segmentIndex: segment.segmentIndex ?? 0,
          sourceGroupIndex: segment.sourceGroupIndex ?? group.groupIndex,
          sourceRowNumber: segment.sourceRowNumber,
          sourceSheet: segment.sourceSheet ?? group.sourceSheet,
          transit: segment.transit ?? "",
          updatedAt: now,
        };
        if (existingSegment) {
          await ctx.db.patch(existingSegment._id, segmentPatch);
          return "updated";
        }
        await ctx.db.insert("flightSegments", {
          ...segmentPatch,
          createdAt: now,
          createdBy: access.authUserId ?? "unknown",
        });
        return "created";
      })
    );
    for (const result of segmentResults) {
      if (result === "created") {
        createdSegments += 1;
      }
      if (result === "updated") {
        updatedSegments += 1;
      }
    }
  }

  await createActivity(ctx, access, {
    action: "imported",
    entityId: jobCardId,
    entityType: "flightGroup",
    message: `${createdSegments + updatedSegments} flight segments imported for ${job.jobCode}`,
  });

  return {
    createdGroups,
    createdSegments,
    totalGroups: args.groups.length,
    totalSegments: args.groups.reduce((sum, group) => sum + group.segments.length, 0),
    updatedGroups,
    updatedSegments,
  };
}

export const commitFlightImport = mutation({
  args: {
    groups: v.array(flightGroupInput),
    jobCardId: v.string(),
  },
  handler: async (ctx, args) =>
    commitFlightImportForTest(ctx, args, await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING)),
});

export const getPassengerExportSource = internalQuery({
  args: {
    access: v.any(),
    jobCardId: v.string(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) {
      throw new ConvexError("FORBIDDEN");
    }

    const [travellers, travelBatches] = await Promise.all([
      ctx.db
        .query("travellers")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect(),
      ctx.db
        .query("travelBatches")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect(),
    ]);
    const travelBatchById = new Map(travelBatches.map((batch) => [String(batch._id), batch]));

    const rows = await Promise.all(
      travellers.sort(travellerExportOrder).map(async (traveller) => {
        const [passport, visaRecord, ticketRows] = await Promise.all([
          ctx.db
            .query("passportDetails")
            .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
            .unique(),
          ctx.db
            .query("visaRecords")
            .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
            .unique(),
          ctx.db
            .query("tickets")
            .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
            .collect(),
        ]);
        const ticketRowsWithPnr = await Promise.all(
          ticketRows.map(async (ticket) => {
            const pnr = ticket.pnrId ? await ctx.db.get(ticket.pnrId) : null;
            return {
              airline: pnr?.airline ?? "",
              fareType: pnr?.fareType ?? "",
              pnrCode: pnr?.pnrCode ?? "",
              route: pnr?.route ?? "",
              ticketNumber: ticket.ticketNumber ?? "",
              ticketType: ticket.ticketType ?? "",
            };
          })
        );

        return {
          cancellation: traveller.cancellation ?? false,
          contactNo: traveller.contactNo ?? "",
          encryptedPassportPayload: passport?.encryptedPayload ?? "",
          foodPreference: traveller.foodPreference,
          fullName: traveller.fullName,
          gender: traveller.gender ?? "",
          givenName: traveller.givenName ?? "",
          hotelAllocation: traveller.hotelAllocation ?? "",
          lastMinuteDrop: traveller.lastMinuteDrop ?? false,
          paymentType: traveller.paymentType,
          roomType: traveller.roomType,
          sourceDealerCode: traveller.sourceDealerCode ?? "",
          sourceDealerName: traveller.sourceDealerName ?? "",
          sourceDescription: traveller.sourceDescription ?? "",
          sourceGroup: traveller.sourceGroup ?? "",
          sourceRowNumber: traveller.sourceRowNumber ?? null,
          sourceRsoName: traveller.sourceRsoName ?? "",
          sourceSheet: traveller.sourceSheet ?? "",
          sourceSoName: traveller.sourceSoName ?? "",
          specialRequests: traveller.specialRequests ?? "",
          surname: traveller.surname ?? "",
          tickets: ticketRowsWithPnr,
          travelBatchCode:
            travelBatchById.get(String(traveller.travelBatchId ?? ""))?.batchCode ?? "",
          travelBatchId: traveller.travelBatchId ?? "",
          travelBatchReference:
            travelBatchById.get(String(traveller.travelBatchId ?? ""))?.batchReference ?? "",
          travelHub: traveller.travelHub ?? "",
          travellerId: traveller._id,
          visa: visaRecord
            ? {
                appointmentDate: visaRecord.appointmentDate ?? "",
                notes: visaRecord.notes ?? "",
                status: visaRecord.status,
              }
            : {
                appointmentDate: traveller.biometricAppointmentDate ?? "",
                notes: "",
                status: traveller.visaStatus,
              },
          visaRequired: traveller.visaRequired,
          visaStatus: traveller.visaStatus,
        };
      })
    );

    return {
      clientName: job.clientName,
      jobCode: job.jobCode,
      rows,
    };
  },
});

export const logPassengerExport = internalMutation({
  args: {
    access: v.any(),
    exportKind: v.optional(exportKindValidator),
    jobCardId: v.string(),
    rowCount: v.number(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      return;
    }
    const job = await ctx.db.get(jobCardId);
    if (!job) {
      return;
    }

    const exportedKind = args.exportKind ?? "passenger";
    const exportedLabel =
      exportedKind === "passenger"
        ? "passengers"
        : exportedKind === "traveller"
          ? "travellers"
          : `${exportedKind} rows`;

    await createActivity(ctx, args.access, {
      action: "exported",
      entityId: jobCardId,
      entityType: "traveller",
      message: `${args.rowCount} ${exportedLabel} exported for ${job.jobCode}`,
    });
  },
});

export const listFlightItinerary = query({
  args: {},
  handler: async (ctx) => {
    const [access, groups] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_TICKETING),
      ctx.db.query("flightGroups").collect(),
    ]);
    const result = await Promise.all(
      groups
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(async (group) => {
          const job = await getVisibleJob(ctx, access, group.jobCardId);
          if (!job) {
            return null;
          }
          const segments = await ctx.db
            .query("flightSegments")
            .withIndex("by_flightGroupId", (q) => q.eq("flightGroupId", group._id))
            .collect();
          const travelBatch = group.travelBatchId ? await ctx.db.get(group.travelBatchId) : null;
          return {
            airline: group.airline,
            arrivalDate: group.arrivalDate ?? "",
            clientName: job.clientName,
            departureDate: group.departureDate,
            id: group._id,
            importKey: group.importKey ?? "",
            jobCardId: group.jobCardId,
            jobCode: job.jobCode,
            name: group.name,
            route: group.route,
            segments: segments
              .sort((a, b) => a.segmentIndex - b.segmentIndex)
              .map((segment) => ({
                airline: segment.airline,
                arriveTime: segment.arriveTime ?? "",
                dateLabel: segment.dateLabel,
                departTime: segment.departTime ?? "",
                destination: segment.destination,
                duration: segment.duration ?? "",
                flightNumber: segment.flightNumber,
                id: segment._id,
                importKey: segment.importKey,
                origin: segment.origin,
                transit: segment.transit ?? "",
              })),
            sourceGroupIndex: group.sourceGroupIndex ?? 0,
            sourceSheet: group.sourceSheet ?? "",
            travelBatchCode: travelBatch?.batchCode ?? "",
            travelBatchId: group.travelBatchId ?? "",
            travelBatchReference: travelBatch?.batchReference ?? "",
            updatedAt: new Date(group.updatedAt).toISOString(),
          };
        })
    );
    return result.filter(Boolean);
  },
});
