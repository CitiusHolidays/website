import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { canSeeJobCardRecord, createActivity, notifyStaffMember, requireHeadOrAdmin } from "./lib";

export async function assertTicketingTeamStaff(ctx: any, staffId: Id<"staffUsers">) {
  const staff = await ctx.db.get(staffId);
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
  ctx: any,
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
  const job = await ctx.db.get(jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  const ownerName = staff.name.trim();
  await Promise.all([
    ctx.db.patch(jobCardId, {
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
    notifyStaffMember(ctx, staffId, {
      body: `You were assigned as ticketing owner for ${job.jobCode}.`,
      entityId: jobCardId,
      entityType: "jobCard",
      title: "Assign ticketing owner",
    }),
  ]);
  return { id: jobCardId };
}
