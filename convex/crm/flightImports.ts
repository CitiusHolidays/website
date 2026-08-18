import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getVisibleJob, resolveImportTravelBatchId } from "./importProcessor";
import { createActivity, PERMISSIONS, type PortalAccess, requireStaff } from "./lib";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";

export const flightSegmentInput = v.object({
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

export const flightGroupInput = v.object({
  groupIndex: v.number(),
  id: v.string(),
  name: v.string(),
  segments: v.array(flightSegmentInput),
  sourceSheet: v.string(),
  travelBatchId: v.optional(v.string()),
  travelBatchReference: v.optional(v.string()),
});

export interface CommitFlightImportArgs {
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
  jobCardId: Id<"jobCards">;
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

function summarizeGroup(group: CommitFlightImportArgs["groups"][number]) {
  const [first] = group.segments;
  // biome-ignore lint/style/useAtIndex: the Convex TypeScript target does not include Array.at.
  const last = group.segments[group.segments.length - 1] ?? first;
  const airlines = Array.from(
    group.segments.reduce((set, segment) => {
      if (segment.airline) {
        set.add(segment.airline);
      }
      return set;
    }, new Set<string>())
  );
  const flightNumbers = group.segments.flatMap((segment) =>
    segment.flightNumber ? [segment.flightNumber] : []
  );
  return {
    airline: airlines.length === 1 ? airlines[0] : airlines.join(" / "),
    arrivalDate: last?.dateLabel ?? "",
    departureDate: first?.dateLabel ?? "",
    flightNumber: flightNumbers.join(" / "),
    name: `${group.sourceSheet} itinerary ${group.groupIndex + 1}`,
    route: [first?.origin, last?.destination].filter(Boolean).join(" - "),
  };
}

export async function commitFlightImportForTest(
  ctx: MutationCtx,
  args: CommitFlightImportArgs,
  access: PortalAccess
) {
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new Error("Invalid Job Card id");
  }
  const job = await getVisibleJob(ctx, access, jobCardId);
  if (!job) {
    throw new Error("FORBIDDEN");
  }
  const now = Date.now();
  let createdGroups = 0;
  let updatedGroups = 0;
  let createdSegments = 0;
  let updatedSegments = 0;

  for (const group of args.groups) {
    const importKey = groupImportKey(group.sourceSheet, group.groupIndex);
    const summary = summarizeGroup(group);
    // biome-ignore lint/performance/noAwaitInLoops: each group replaces one ordered itinerary atomically.
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
      await ctx.db.patch("flightGroups", existingGroup._id, groupFields);
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
      existingSegments.flatMap((segment) =>
        incomingKeys.has(segment.importKey) ? [] : [ctx.db.delete("flightSegments", segment._id)]
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
          await ctx.db.patch("flightSegments", existingSegment._id, segmentPatch);
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
    createdSegments += segmentResults.filter((result) => result === "created").length;
    updatedSegments += segmentResults.filter((result) => result === "updated").length;
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

export async function commitFlightImportHandler(ctx: MutationCtx, args: CommitFlightImportArgs) {
  return await commitFlightImportForTest(
    ctx,
    args,
    await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING)
  );
}

export async function listFlightItineraryHandler(
  ctx: QueryCtx,
  args: {
    jobCardId?: Id<"jobCards">;
    paginationOpts: Parameters<typeof boundedPaginationOptions>[0];
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
  const page = await applyCrmCursorFilters(
    ctx.db.query("flightGroups").withIndex("by_createdAt").order("desc"),
    { equals: { jobCardId: args.jobCardId } }
  ).paginate(boundedPaginationOptions(args.paginationOpts));
  const rows = await mapInBoundedBatches(page.page, async (group) => {
    const job = await getVisibleJob(ctx, access, group.jobCardId);
    if (!job) {
      return null;
    }
    const segments = await ctx.db
      .query("flightSegments")
      .withIndex("by_flightGroupId", (q) => q.eq("flightGroupId", group._id))
      .take(64);
    const travelBatch = group.travelBatchId
      ? await ctx.db.get("travelBatches", group.travelBatchId)
      : null;
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
        .sort((left, right) => left.segmentIndex - right.segmentIndex)
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
  });
  return { ...page, page: compactPageItems(rows) };
}
