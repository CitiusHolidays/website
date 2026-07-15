import { getVisibleJob } from "./jobCardVisibility";
import { PERMISSIONS, requireStaff } from "./lib";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";
import { publicPnr } from "./ticketingPresentation";

export async function handleListPnrs(ctx: any, args: any) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
  const page = await applyCrmCursorFilters(
    ctx.db.query("pnrs").withIndex("by_createdAt").order("desc"),
    { equals: { jobCardId: args.jobCardId, status: args.status } }
  ).paginate(boundedPaginationOptions(args.paginationOpts));
  const rows = await mapInBoundedBatches(page.page, async (pnr: any) => {
    const job = await getVisibleJob(ctx, access, pnr.jobCardId);
    return job ? publicPnr(pnr, job) : null;
  });
  return { ...page, page: compactPageItems(rows) };
}
