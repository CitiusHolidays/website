import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { canSeeJobCardRecord } from "./recordScope";
import type { PortalAccess } from "./staffAccess";

export async function canPreparePostTourReport(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  job: Doc<"jobCards">
) {
  if (!access.staffId) {
    return false;
  }
  const query = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
  if (access.roles.includes("Operations Head") && canSeeJobCardRecord(access, job, query)) {
    return true;
  }
  if (
    access.roles.some((role) => role === "Operations" || role === "Operations Cement") &&
    (job.operationsOwnerId === access.staffId ||
      Boolean(access.authUserId && job.operationsOwnerId === access.authUserId)) &&
    canSeeJobCardRecord(access, job, query)
  ) {
    return true;
  }
  if (!access.roles.includes("Tour Manager")) {
    return false;
  }
  const assignments = await ctx.db
    .query("tourManagerAssignments")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))
    .take(101);
  if (assignments.length > 100) {
    return false;
  }
  const active = assignments.filter((a) => a.status === "Assigned");
  if (active.some((a) => a.staffId === access.staffId)) {
    return true;
  }
  const name = access.name.trim().toLowerCase();
  if (
    active.some(
      (a) =>
        (a.externalProfileId || (a.staffId && a.staffId !== access.staffId)) &&
        a.name.trim().toLowerCase() === name
    )
  ) {
    return false;
  }
  if (
    active.some((a) => !(a.staffId || a.externalProfileId) && a.name.trim().toLowerCase() === name)
  ) {
    return true;
  }
  return (
    assignments.length === 0 &&
    !job.tourManagerId &&
    Boolean(name && job.tourManagerName?.trim().toLowerCase() === name)
  );
}
