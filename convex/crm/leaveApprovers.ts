import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import {
  LEAVE_ALERT_NAME_TOKENS,
  LEAVE_MATRIX_ALERT_BY_EMAIL,
  leaveAlertToken,
} from "./leaveMatrixData";

export const LEAVE_HEAD_APPROVER_PICKER_ROLES = [
  "Directors",
  "Sales Head",
  "Contracting Head",
  "Operations Head",
  "Head of Ticketing",
] as const;

import {
  getHeadReviewerRolesForStaff,
  isDirectorOrAdmin,
  normalizeEmail,
  notifyRoles,
  notifyStaffMember,
  PERMISSIONS,
  requireStaff,
} from "./lib";

const DIRECTOR_ROLES = new Set(["Directors", "Admin"]);

type StaffRow = {
  _id: Id<"staffUsers">;
  email: string;
  emailNormalized?: string;
  name: string;
  roles: string[];
  active: boolean;
  leaveHeadApproverId?: Id<"staffUsers">;
};

function staffMatchesAlertToken(staff: StaffRow, token: string) {
  if (!token) return false;
  if (token === LEAVE_ALERT_NAME_TOKENS.directors) {
    return staff.roles.some((role) => DIRECTOR_ROLES.has(role));
  }
  const name = staff.name.toLowerCase();
  return name.includes(token);
}

export function resolveAlertLabelToStaff(
  staffRows: StaffRow[],
  alertLabel: string,
): StaffRow | null {
  const token = leaveAlertToken(alertLabel);
  if (!token) return null;
  const matches = staffRows.filter((row) => row.active && staffMatchesAlertToken(row, token));
  if (matches.length === 0) return null;
  if (token === LEAVE_ALERT_NAME_TOKENS.directors) {
    return (
      matches.find((row) => row.roles.includes("Directors")) ??
      matches.find((row) => row.roles.includes("Admin")) ??
      matches[0]
    );
  }
  return matches.reduce((best, row) =>
    row.name.localeCompare(best.name) < 0 ? row : best,
  );
}

export function matrixAlertForStaffEmail(email: string) {
  const normalized = normalizeEmail(email);
  return LEAVE_MATRIX_ALERT_BY_EMAIL[normalized] ?? LEAVE_MATRIX_ALERT_BY_EMAIL[email.trim()] ?? "";
}

export async function resolveLeaveHeadApproverIdFromMatrix(
  ctx: QueryCtx | MutationCtx,
  staff: StaffRow,
  staffRows?: StaffRow[],
): Promise<Id<"staffUsers"> | null> {
  const alertLabel = matrixAlertForStaffEmail(staff.email);
  if (!alertLabel) {
    return null;
  }
  const rows = staffRows ?? ((await ctx.db.query("staffUsers").collect()) as StaffRow[]);
  const match = resolveAlertLabelToStaff(rows, alertLabel);
  return match?._id ?? null;
}

export async function resolveLeaveHeadApproverId(
  ctx: QueryCtx | MutationCtx,
  staff: StaffRow,
  staffRows?: StaffRow[],
): Promise<Id<"staffUsers"> | null> {
  if (staff.leaveHeadApproverId) {
    const configured = await ctx.db.get(staff.leaveHeadApproverId);
    if (configured?.active) {
      return staff.leaveHeadApproverId;
    }
  }
  return resolveLeaveHeadApproverIdFromMatrix(ctx, staff, staffRows);
}

export async function notifyLeaveRequestSubmitted(
  ctx: MutationCtx,
  args: {
    leaveId: Id<"staffLeaveRecords">;
    staff: StaffRow;
    headApproverId: Id<"staffUsers"> | null;
    leaveType: string;
    startDate: string;
    endDate: string;
  },
) {
  const headApprover = args.headApproverId ? await ctx.db.get(args.headApproverId) : null;
  const summary = `${args.staff.name} requested ${args.leaveType} leave from ${args.startDate} to ${args.endDate}.`;
  const payload = {
    title: "Leave request pending",
    body: summary,
    entityType: "leave",
    entityId: args.leaveId,
  };

  if (headApprover) {
    await notifyStaffMember(ctx, headApprover._id, {
      ...payload,
      title: "Leave awaiting your approval",
      body: `${summary} You are the department head approver.`,
    });
  }

  await notifyRoles(ctx, ["HR"], {
    ...payload,
    title: "Leave submitted (HR copy)",
    body: `${summary} HR final approval is required after the head approver decides.`,
  });
}

export function primaryHeadRoleForStaff(staff: { roles?: string[]; department?: string }) {
  return getHeadReviewerRolesForStaff(staff).find((role) => role !== "HR") ?? "HR";
}

export function canApproveLeaveAsHead(
  access: {
    staffId?: Id<"staffUsers"> | null;
    roles: string[];
  },
  leave: {
    headReviewStatus?: string;
    headApproverStaffId?: Id<"staffUsers">;
  },
  staff: StaffRow,
  resolvedHeadApproverId: Id<"staffUsers"> | null,
) {
  const headStatus = leave.headReviewStatus ?? "Pending";
  if (headStatus !== "Pending") {
    return false;
  }
  const approverId =
    leave.headApproverStaffId ?? staff.leaveHeadApproverId ?? resolvedHeadApproverId ?? null;
  if (approverId && access.staffId && access.staffId === approverId) {
    return true;
  }
  return isDirectorOrAdmin(access as any);
}

export function getLeaveApprovalActionsForApprover(
  access: {
    staffId?: Id<"staffUsers"> | null;
    roles: string[];
    permissions: string[];
  },
  leave: {
    status?: string;
    headReviewStatus?: string;
    hrReviewStatus?: string;
    headApproverStaffId?: Id<"staffUsers">;
    headApproverName?: string;
  },
  staff: StaffRow,
  resolvedHeadApproverId: Id<"staffUsers"> | null,
  isHrReviewer: (access: any) => boolean,
) {
  const status = leave.status ?? "Pending";
  const headStatus = leave.headReviewStatus ?? "Pending";
  const hrStatus = leave.hrReviewStatus ?? "Pending";

  if (status !== "Pending") {
    return { canApproveHead: false, canApproveHr: false, canReject: false };
  }

  const canHead = canApproveLeaveAsHead(access, leave, staff, resolvedHeadApproverId);
  const canHr = isHrReviewer(access);

  if (headStatus === "Pending") {
    return {
      canApproveHead: canHead,
      canApproveHr: false,
      canReject: canHead,
    };
  }

  if (headStatus === "Approved" && hrStatus === "Pending") {
    return {
      canApproveHead: false,
      canApproveHr: canHr,
      canReject: canHr,
    };
  }

  return { canApproveHead: false, canApproveHr: false, canReject: false };
}

export const applyMatrixDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    const staffRows = (await ctx.db.query("staffUsers").collect()) as StaffRow[];
    const now = Date.now();
    const outcomes = await Promise.all(
      staffRows.map(async (staff) => {
        if (!staff.active) {
          return "inactive" as const;
        }
        const approverId = await resolveLeaveHeadApproverIdFromMatrix(ctx, staff, staffRows);
        if (!approverId) {
          return "skipped" as const;
        }
        if (staff.leaveHeadApproverId === approverId) {
          return "unchanged" as const;
        }
        await ctx.db.patch(staff._id, {
          leaveHeadApproverId: approverId,
          updatedAt: now,
        });
        return "updated" as const;
      }),
    );
    const updated = outcomes.filter((outcome) => outcome === "updated").length;
    const skipped = outcomes.filter((outcome) => outcome === "skipped").length;

    return { updated, skipped };
  },
});

export const listHeadApproverCandidates = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    const rows = await ctx.db.query("staffUsers").collect();
    return rows
      .filter(
        (staff) =>
          staff.active &&
          staff.roles.some((role) => LEAVE_HEAD_APPROVER_PICKER_ROLES.includes(role as any)),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((staff) => ({
        id: staff._id,
        name: staff.name,
        email: staff.email,
        roles: staff.roles,
        label: `${staff.name} (${staff.roles.filter((role) => LEAVE_HEAD_APPROVER_PICKER_ROLES.includes(role as any)).join(", ")})`,
      }));
  },
});
