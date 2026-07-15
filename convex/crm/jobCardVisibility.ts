import type { Id } from "../_generated/dataModel";
import { canSeeJobCardRecord } from "./lib";

export async function getVisibleJob(ctx: any, access: any, jobCardId: Id<"jobCards"> | any) {
  const job = await ctx.db.get(jobCardId);
  if (!job) {
    return null;
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  return canSeeJobCardRecord(access, job, linkedQuery) ? job : null;
}
