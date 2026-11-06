import { PERMISSIONS, requireStaff } from "./lib";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";
import { createTravellerScopeReader } from "./tourManagerGroupScope";

export async function handleListSeatAllocations(
  ctx: QueryCtx,
  args: {
    jobCardId?: string;
    paginationOpts: Parameters<typeof boundedPaginationOptions>[0];
    status?: Doc<"seatAllocations">["status"];
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
  const scopeReader = createTravellerScopeReader(ctx, access);
  const page = await applyCrmCursorFilters(
    ctx.db.query("seatAllocations").withIndex("by_createdAt").order("desc"),
    { equals: { jobCardId: args.jobCardId, status: args.status } }
  ).paginate(boundedPaginationOptions(args.paginationOpts));
  const rows = await mapInBoundedBatches(page.page, async (seat) => {
    const traveller = seat.travellerId ? await ctx.db.get("travellers", seat.travellerId) : null;
    const job = await scopeReader.jobForTraveller(seat.jobCardId, traveller);
    if (!job) {
      return null;
    }
    return {
      clientName: job?.clientName ?? "",
      createdAt: new Date(seat.createdAt).toISOString(),
      id: seat._id,
      jobCardId: seat.jobCardId,
      jobCode: job?.jobCode ?? "",
      notes: seat.notes ?? "",
      pnrId: seat.pnrId ?? null,
      seatNumber: seat.seatNumber,
      status: seat.status,
      travellerId: seat.travellerId ?? null,
      travellerName: traveller?.fullName ?? "",
    };
  });
  return { ...page, page: compactPageItems(rows) };
}

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
