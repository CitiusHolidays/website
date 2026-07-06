import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
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
import { createActivity, PERMISSIONS, requireStaff } from "./lib";

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
  travelBatchId: v.optional(v.string()),
  travelBatchReference: v.optional(v.string()),
  segments: v.array(flightSegmentInput),
});

function travellerExportOrder(a: any, b: any) {
  const aImported = typeof a.sourceRowNumber === "number";
  const bImported = typeof b.sourceRowNumber === "number";
  if (aImported !== bImported) return aImported ? -1 : 1;
  if (aImported && bImported) {
    const sheetCompare = String(a.sourceSheet ?? "").localeCompare(String(b.sourceSheet ?? ""));
    if (sheetCompare !== 0) return sheetCompare;
    if (a.sourceRowNumber !== b.sourceRowNumber) return a.sourceRowNumber - b.sourceRowNumber;
  }
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.fullName.localeCompare(b.fullName);
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
    group.segments.reduce((set, segment) => {
      if (segment.airline) set.add(segment.airline);
      return set;
    }, new Set<string>()),
  );
  const flightNumbers = group.segments.reduce((items, segment) => {
    if (segment.flightNumber) items.push(segment.flightNumber);
    return items;
  }, [] as string[]);
  return {
    name: `${group.sourceSheet} itinerary ${group.groupIndex + 1}`,
    route: [first?.origin, last?.destination].filter(Boolean).join(" - "),
    airline: airlines.length === 1 ? airlines[0] : airlines.join(" / "),
    flightNumber: flightNumbers.join(" / "),
    departureDate: first?.dateLabel ?? "",
    arrivalDate: last?.dateLabel ?? "",
  };
}

export const previewPassengerImportRows = internalQuery({
  args: {
    jobCardId: v.string(),
    rows: v.array(internalPassengerImportRow),
    access: v.any(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) throw new ConvexError("FORBIDDEN");

    const matchIndex = await buildTravellerMatchIndex(ctx, jobCardId);
    const results = args.rows.map((row) => {
      const match = findTravellerMatchInIndex(matchIndex, row);
      return {
        id: row.id,
        action: match ? "update" : "create",
        travellerId: match?._id ?? null,
        travellerName: match?.fullName ?? "",
      };
    });
    return { rows: results, roomSummary: summarizeRoomTypesFromRows(args.rows) };
  },
});

export const commitPassengerImportBatch = internalMutation({
  args: {
    jobCardId: v.string(),
    rows: v.array(internalPassengerImportRow),
    access: v.any(),
    logActivity: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) throw new ConvexError("FORBIDDEN");

    const matchIndex = await buildTravellerMatchIndex(ctx, jobCardId);
    return await processImportRows(ctx, {
      jobCardId,
      rows: args.rows,
      access: args.access,
      job,
      matchIndex,
      logActivity: args.logActivity ?? false,
    });
  },
});

export const commitPassengerImportRows = internalMutation({
  args: {
    jobCardId: v.string(),
    rows: v.array(internalPassengerImportRow),
    access: v.any(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) throw new ConvexError("FORBIDDEN");

    const matchIndex = await buildTravellerMatchIndex(ctx, jobCardId);
    return await processImportRows(ctx, {
      jobCardId,
      rows: args.rows,
      access: args.access,
      job,
      matchIndex,
      logActivity: true,
    });
  },
});

export async function commitFlightImportForTest(
  ctx: any,
  args: {
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
  },
  access: any,
) {
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
    const travelBatchId = await resolveImportTravelBatchId(ctx, jobCardId, group);
    const existingGroup = await ctx.db
      .query("flightGroups")
      .withIndex("by_jobCardId_importKey", (q) =>
        q.eq("jobCardId", jobCardId).eq("importKey", importKey),
      )
      .first();

    let flightGroupId: Id<"flightGroups">;
    const groupPatch: Record<string, unknown> = {
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
    groupPatch.travelBatchId = travelBatchId;

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
    const existingSegmentByImportKey = new Map(
      existingSegments.map((segment) => [segment.importKey, segment]),
    );
    await Promise.all(
      existingSegments.flatMap((existingSegment) =>
        incomingKeys.has(existingSegment.importKey) ? [] : [ctx.db.delete(existingSegment._id)],
      ),
    );

    const segmentResults = await Promise.all(
      group.segments.map(async (segment) => {
        const existingSegment = existingSegmentByImportKey.get(segment.importKey);
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
          return "updated";
        }
        await ctx.db.insert("flightSegments", {
          ...segmentPatch,
          createdBy: access.authUserId ?? "unknown",
          createdAt: now,
        });
        return "created";
      }),
    );
    for (const result of segmentResults) {
      if (result === "created") createdSegments += 1;
      if (result === "updated") updatedSegments += 1;
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
}

export const commitFlightImport = mutation({
  args: {
    jobCardId: v.string(),
    groups: v.array(flightGroupInput),
  },
  handler: async (ctx, args) =>
    commitFlightImportForTest(ctx, args, await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING)),
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
    const travelBatches = await ctx.db
      .query("travelBatches")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
      .collect();
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
              ticketNumber: ticket.ticketNumber ?? "",
              ticketType: ticket.ticketType ?? "",
              pnrCode: pnr?.pnrCode ?? "",
              airline: pnr?.airline ?? "",
              route: pnr?.route ?? "",
              fareType: pnr?.fareType ?? "",
            };
          }),
        );

        return {
          travellerId: traveller._id,
          travelBatchId: traveller.travelBatchId ?? "",
          travelBatchReference:
            travelBatchById.get(String(traveller.travelBatchId ?? ""))?.batchReference ?? "",
          travelBatchCode:
            travelBatchById.get(String(traveller.travelBatchId ?? ""))?.batchCode ?? "",
          fullName: traveller.fullName,
          surname: traveller.surname ?? "",
          givenName: traveller.givenName ?? "",
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
          sourceSheet: traveller.sourceSheet ?? "",
          sourceRowNumber: traveller.sourceRowNumber ?? null,
          cancellation: traveller.cancellation ?? false,
          lastMinuteDrop: traveller.lastMinuteDrop ?? false,
          encryptedPassportPayload: passport?.encryptedPayload ?? "",
          tickets: ticketRowsWithPnr,
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
        };
      }),
    );

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
    exportKind: v.optional(exportKindValidator),
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
    const [access, groups] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_TICKETING),
      ctx.db.query("flightGroups").collect(),
    ]);
    const result = await Promise.all(
      groups
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(async (group) => {
          const job = await getVisibleJob(ctx, access, group.jobCardId);
          if (!job) return null;
          const segments = await ctx.db
            .query("flightSegments")
            .withIndex("by_flightGroupId", (q) => q.eq("flightGroupId", group._id))
            .collect();
          const travelBatch = group.travelBatchId ? await ctx.db.get(group.travelBatchId) : null;
          return {
            id: group._id,
            jobCardId: group.jobCardId,
            jobCode: job.jobCode,
            clientName: job.clientName,
            travelBatchId: group.travelBatchId ?? "",
            travelBatchReference: travelBatch?.batchReference ?? "",
            travelBatchCode: travelBatch?.batchCode ?? "",
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
          };
        }),
    );
    return result.filter(Boolean);
  },
});
