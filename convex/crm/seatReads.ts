import { getVisibleJob } from "./jobCardVisibility";
import { PERMISSIONS, requireStaff } from "./lib";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";

export async function handleListSeatAllocations(ctx: any, args: any) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
  const page = await applyCrmCursorFilters(
    ctx.db.query("seatAllocations").withIndex("by_createdAt").order("desc"),
    { equals: { jobCardId: args.jobCardId, status: args.status } }
  ).paginate(boundedPaginationOptions(args.paginationOpts));
  const rows = await mapInBoundedBatches(page.page, async (seat: any) => {
    const [traveller, job] = await Promise.all([
      seat.travellerId ? ctx.db.get(seat.travellerId) : null,
      getVisibleJob(ctx, access, seat.jobCardId),
    ]);
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
