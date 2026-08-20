import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { canSeeJobCardRecord } from "./lib";
import type { PortalAccess } from "./lib/staffAccess";

export async function getVisibleJob(
  ctx: MutationCtx | QueryCtx,
  access: PortalAccess,
  jobCardId: Id<"jobCards">
) {
  const job = await ctx.db.get("jobCards", jobCardId);
  if (!job) {
    return null;
  }
  const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
  return canSeeJobCardRecord(access, job, linkedQuery) ? job : null;
}
