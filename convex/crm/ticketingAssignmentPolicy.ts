import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import {
  canSeeJobCardRecord,
  createActivity,
  publishWorkflowNotification,
  requireHeadOrAdmin,
} from "./lib";

export async function assertTicketingTeamStaff(ctx: MutationCtx, staffId: Id<"staffUsers">) {
  const staff = await ctx.db.get("staffUsers", staffId);
  if (!staff?.active) {
    throw new ConvexError("Staff member not found");
  }
  const isTicketingTeam = staff.roles.some((role: string) =>
    ["Ticketing", "Head of Ticketing"].includes(role)
  );
  if (!isTicketingTeam) {
    throw new ConvexError("Selected staff member is not on the ticketing team");
  }
  return staff;
}

export async function handleAssignTicketingOwner(
  ctx: MutationCtx,
  args: {
    jobCardId: string;
    staffId: string;
  }
) {
  const access = await requireHeadOrAdmin(ctx, ["Head of Ticketing"]);
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
  if (!staffId) {
    throw new ConvexError("Invalid staff id");
  }
  const staff = await assertTicketingTeamStaff(ctx, staffId);
  const job = await ctx.db.get("jobCards", jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  const ownerName = staff.name.trim();
  await Promise.all([
    ctx.db.patch("jobCards", jobCardId, {
      ticketingOwnerId: staffId,
      ticketingOwnerName: ownerName,
      updatedAt: Date.now(),
    }),
    createActivity(ctx, access, {
      action: "assigned_ticketing",
      entityId: jobCardId,
      entityType: "jobCard",
      message: `${job.jobCode} assigned to ${ownerName} (Ticketing)`,
    }),
    publishWorkflowNotification(ctx, {
      bellTargets: { kind: "staff", staffIds: [staffId] },
      content: {
        body: `You were assigned as ticketing owner for ${job.jobCode}.`,
        entityId: jobCardId,
        entityType: "jobCard",
        title: "Assign ticketing owner",
      },
      emailTargets: { kind: "staff", staffIds: [staffId] },
    }),
  ]);
  await scheduleCrmMetricSync(ctx, "jobCards", String(jobCardId));
  return { id: jobCardId };
}
