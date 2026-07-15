import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { hasRole, isDirectorOrAdmin, notifyStaffMember } from "./lib";

interface StaffNotificationTarget {
  _id: Id<"staffUsers">;
  active: boolean;
  function?: string | null;
}

export function isFinanceHeadStaff(staff: StaffNotificationTarget) {
  return (
    staff.active &&
    String(staff.function ?? "")
      .trim()
      .toLowerCase() === "finance head"
  );
}

export function queryRequiresTicketingWork(query?: {
  ticketingOwnerId?: string | null;
  ticketingScope?: string | null;
}) {
  const scope = String(query?.ticketingScope ?? "").trim();
  if (scope) {
    return scope !== "Not required";
  }
  return Boolean(query?.ticketingOwnerId);
}

export function canCreateJobCardFromConfirmedQuery(
  access: Parameters<typeof isDirectorOrAdmin>[0],
  staff?: { jobCardCreatorEnabled?: boolean } | null
) {
  return (
    isDirectorOrAdmin(access) ||
    hasRole(access, "Accounts") ||
    hasRole(access, "Accounts Head") ||
    Boolean(staff?.jobCardCreatorEnabled)
  );
}

export async function notifyFinanceHeadsOnJobCardCreation(
  ctx: MutationCtx,
  jobCode: string,
  jobCardId: Id<"jobCards">
) {
  const staffRows = await ctx.db.query("staffUsers").collect();
  const financeHeads = staffRows.filter(isFinanceHeadStaff);
  await Promise.all(
    financeHeads.map((staff) =>
      notifyStaffMember(ctx, staff._id, {
        body: `${jobCode} has been created and is ready for finance tracking.`,
        entityId: jobCardId,
        entityType: "jobCard",
        title: "Job Card opened",
      })
    )
  );
}
