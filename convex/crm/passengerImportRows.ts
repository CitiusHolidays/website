import { ConvexError, type Infer, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  buildTravellerMatchIndex,
  findTravellerMatchInIndex,
  getVisibleJob,
  processImportRows,
  summarizeRoomTypesFromRows,
} from "./importProcessor";
import type { internalPassengerImportRow } from "./importRowValidators";
import type { PortalAccess } from "./lib";
import { canManagePassengerKinds } from "./passengerKindPolicy";

type PassengerImportRow = Infer<typeof internalPassengerImportRow>;

export const importErrorResultValidator = v.object({
  id: v.string(),
  kind: v.union(v.literal("retryable"), v.literal("terminal")),
  message: v.string(),
  sourceRowNumber: v.optional(v.number()),
  sourceSheet: v.optional(v.string()),
});

export const importRowResultValidator = v.object({
  disposition: v.union(v.literal("created"), v.literal("updated"), v.literal("failed")),
  fullName: v.string(),
  id: v.string(),
  message: v.optional(v.string()),
  sourceRowNumber: v.optional(v.number()),
  sourceSheet: v.optional(v.string()),
});

export const importBatchStatusValidator = v.union(
  v.literal("processing"),
  v.literal("completed"),
  v.literal("retryable")
);

export const passengerImportBatchResultValidator = v.object({
  accepted: v.number(),
  batchId: v.string(),
  created: v.number(),
  errors: v.array(importErrorResultValidator),
  failed: v.number(),
  processed: v.number(),
  remaining: v.number(),
  roomSummary: v.record(v.string(), v.number()),
  rowResults: v.array(importRowResultValidator),
  status: importBatchStatusValidator,
  updated: v.number(),
});

export async function previewPassengerImportRowsHandler(
  ctx: QueryCtx,
  args: { access: PortalAccess; jobCardId: Id<"jobCards">; rows: PassengerImportRow[] }
) {
  if (
    !canManagePassengerKinds(
      args.access,
      args.rows.map((row) => row.importKind ?? "passenger")
    )
  ) {
    throw new ConvexError("FORBIDDEN");
  }
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
      travellerName: match ? match.fullName : "",
    };
  });
  return { roomSummary: summarizeRoomTypesFromRows(args.rows), rows: results };
}

async function resolveBoundedTravellerMatch(
  ctx: MutationCtx,
  jobCardId: Id<"jobCards">,
  row: PassengerImportRow,
  expectedTravellerId?: Id<"travellers">
) {
  if (expectedTravellerId) {
    const expected = await ctx.db.get("travellers", expectedTravellerId);
    if (!(expected && String(expected.jobCardId) === String(jobCardId))) {
      throw new ConvexError("Passenger import match no longer belongs to the selected Job Card");
    }
    return expected;
  }
  if (row.passportNumberHash) {
    const passport = await ctx.db
      .query("passportDetails")
      .withIndex("by_passportNumberHash", (q) => q.eq("passportNumberHash", row.passportNumberHash))
      .first();
    const traveller = passport ? await ctx.db.get("travellers", passport.travellerId) : null;
    if (traveller && String(traveller.jobCardId) === String(jobCardId)) {
      return traveller;
    }
  }
  return await ctx.db
    .query("travellers")
    .withIndex("by_jobCardId_importKey", (q) =>
      q.eq("jobCardId", jobCardId).eq("importKey", row.importKey)
    )
    .unique();
}

export async function commitPassengerImportRowHandler(
  ctx: MutationCtx,
  args: {
    access: PortalAccess;
    expectedTravellerId?: Id<"travellers">;
    jobCardId: Id<"jobCards">;
    row: PassengerImportRow;
  }
) {
  const importKind = args.row.importKind ?? "passenger";
  if (!canManagePassengerKinds(args.access, [importKind])) {
    throw new ConvexError("FORBIDDEN");
  }
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await getVisibleJob(ctx, args.access, jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  const match = await resolveBoundedTravellerMatch(
    ctx,
    jobCardId,
    args.row,
    args.expectedTravellerId
  );
  const matchIndex = {
    byImportKey: new Map<string, Doc<"travellers">>(),
    byNormalizedName: new Map<string, Doc<"travellers">>(),
    byPassportHash: new Map<string, Doc<"travellers">>(),
  };
  if (match) {
    if (match.importKey) {
      matchIndex.byImportKey.set(match.importKey, match);
    }
    matchIndex.byNormalizedName.set(match.fullName.trim().toLowerCase(), match);
    if (args.row.passportNumberHash) {
      matchIndex.byPassportHash.set(args.row.passportNumberHash, match);
    }
  }
  const result = await processImportRows(ctx, {
    access: args.access,
    failFast: true,
    job,
    jobCardId,
    matchIndex,
    rows: [args.row],
  });
  const [travellerId] = result.committedTravellerIds;
  if (!travellerId) {
    throw new ConvexError("Passenger import row did not commit");
  }
  const { committedTravellerIds: _committedTravellerIds, ...publicResult } = result;
  return { ...publicResult, travellerId };
}
