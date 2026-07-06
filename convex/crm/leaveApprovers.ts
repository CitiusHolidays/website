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
  NOTIFICATION_EMAIL_STAGGER_MS,
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
  leaveLevel1ApproverName?: string;
  leaveLevel1ApproverStaffId?: Id<"staffUsers">;
  leaveFinalAuthorityName?: string;
  leaveFinalAuthorityStaffId?: Id<"staffUsers">;
  leaveHrCopyName?: string;
  leaveHrCopyStaffId?: Id<"staffUsers">;
};

function nameKey(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function staffByName(staffRows: StaffRow[], name?: string) {
  const key = nameKey(name);
  if (!key) return null;
  return staffRows.find((row) => row.active && nameKey(row.name) === key) ?? null;
}

async function activeStaffById(
  ctx: QueryCtx | MutationCtx,
  staffId?: Id<"staffUsers">,
): Promise<StaffRow | null> {
  if (!staffId) return null;
  const staff = await ctx.db.get(staffId);
  return staff?.active ? (staff as StaffRow) : null;
}

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
  return matches.reduce((best, row) => (row.name.localeCompare(best.name) < 0 ? row : best));
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
  const manualOverride = await activeStaffById(ctx, staff.leaveHeadApproverId);
  if (manualOverride) {
    return manualOverride._id;
  }

  const workbookLevel1 = await activeStaffById(ctx, staff.leaveLevel1ApproverStaffId);
  if (workbookLevel1) {
    return workbookLevel1._id;
  }

  const rows = staffRows ?? ((await ctx.db.query("staffUsers").collect()) as StaffRow[]);
  const workbookLevel1ByName = staffByName(rows, staff.leaveLevel1ApproverName);
  if (workbookLevel1ByName) {
    return workbookLevel1ByName._id;
  }

  return resolveLeaveHeadApproverIdFromMatrix(ctx, staff, staffRows);
}

export async function resolveLeaveFinalAuthorityId(
  ctx: QueryCtx | MutationCtx,
  staff: StaffRow,
  headApproverId: Id<"staffUsers"> | null,
  staffRows?: StaffRow[],
): Promise<Id<"staffUsers"> | null> {
  const configured = await activeStaffById(ctx, staff.leaveFinalAuthorityStaffId);
  if (configured && configured._id !== headApproverId) {
    return configured._id;
  }

  const rows = staffRows ?? ((await ctx.db.query("staffUsers").collect()) as StaffRow[]);
  const byName = staffByName(rows, staff.leaveFinalAuthorityName);
  if (byName && byName._id !== headApproverId) {
    return byName._id;
  }

  return null;
}

export async function resolveLeaveHrCopyStaffId(
  ctx: QueryCtx | MutationCtx,
  staff: StaffRow,
  staffRows?: StaffRow[],
): Promise<Id<"staffUsers"> | null> {
  const configured = await activeStaffById(ctx, staff.leaveHrCopyStaffId);
  if (configured) {
    return configured._id;
  }

  const rows = staffRows ?? ((await ctx.db.query("staffUsers").collect()) as StaffRow[]);
  return staffByName(rows, staff.leaveHrCopyName)?._id ?? null;
}

export async function notifyLeaveRequestSubmitted(
  ctx: MutationCtx,
  args: {
    leaveId: Id<"staffLeaveRecords">;
    staff: StaffRow;
    headApproverId: Id<"staffUsers"> | null;
    hrCopyStaffId: Id<"staffUsers"> | null;
    leaveType: string;
    startDate: string;
    endDate: string;
  },
) {
  const summary = `${args.staff.name} requested ${args.leaveType} leave from ${args.startDate} to ${args.endDate}.`;
  const payload = {
    title: "Leave request pending",
    body: summary,
    entityType: "leave",
    entityId: args.leaveId,
  };
  let emailDelayMs = 0;
  const notifiedStaffIds = new Set<string>();

  const notifyUniqueStaff = async (
    staffId: Id<"staffUsers"> | null | undefined,
    notification: {
      title: string;
      body: string;
      entityType: string;
      entityId: Id<"staffLeaveRecords">;
    },
  ) => {
    if (!staffId) {
      return;
    }
    const key = String(staffId);
    if (notifiedStaffIds.has(key)) {
      return;
    }
    notifiedStaffIds.add(key);
    await notifyStaffMember(ctx, staffId, notification, { emailDelayMs });
    emailDelayMs += NOTIFICATION_EMAIL_STAGGER_MS;
  };

  await notifyUniqueStaff(args.headApproverId, {
    ...payload,
    title: "Leave awaiting your approval",
    body: `${summary} You are the department head approver.`,
  });

  const hrCopyPayload = {
    ...payload,
    title: "Leave submitted (HR copy)",
    body: `${summary} HR final approval is required after the head approver decides.`,
  };
  if (args.hrCopyStaffId) {
    await notifyUniqueStaff(args.hrCopyStaffId, hrCopyPayload);
  } else {
    await notifyRoles(ctx, ["HR"], hrCopyPayload, { emailDelayMs });
  }
}

export async function notifyLeaveReadyForFinalAuthority(
  ctx: MutationCtx,
  args: {
    leaveId: Id<"staffLeaveRecords">;
    staff: StaffRow;
    finalAuthorityId: Id<"staffUsers">;
  },
) {
  await notifyStaffMember(ctx, args.finalAuthorityId, {
    title: "Leave awaiting final authority approval",
    body: `${args.staff.name}'s leave request has Level 1 approval and needs your final authority review.`,
    entityType: "leave",
    entityId: args.leaveId,
  });
}

export async function notifyLeaveReadyForHr(
  ctx: MutationCtx,
  args: {
    leaveId: Id<"staffLeaveRecords">;
    staff: StaffRow;
    hrCopyStaffId: Id<"staffUsers"> | null;
  },
) {
  const payload = {
    title: "Leave ready for HR approval",
    body: `${args.staff.name}'s leave request has prior approval and needs HR final review.`,
    entityType: "leave",
    entityId: args.leaveId,
  };
  if (args.hrCopyStaffId) {
    await notifyStaffMember(ctx, args.hrCopyStaffId, payload);
  } else {
    await notifyRoles(ctx, ["HR"], payload);
  }
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
    finalReviewStatus?: string;
    hrReviewStatus?: string;
    headApproverStaffId?: Id<"staffUsers">;
    headApproverName?: string;
    finalAuthorityStaffId?: Id<"staffUsers">;
  },
  staff: StaffRow,
  resolvedHeadApproverId: Id<"staffUsers"> | null,
  resolvedFinalAuthorityId: Id<"staffUsers"> | null,
  isHrReviewer: (access: any) => boolean,
) {
  const status = leave.status ?? "Pending";
  const headStatus = leave.headReviewStatus ?? "Pending";
  const finalAuthorityId = leave.finalAuthorityStaffId ?? resolvedFinalAuthorityId ?? null;
  const finalStatus = finalAuthorityId ? (leave.finalReviewStatus ?? "Pending") : "Approved";
  const hrStatus = leave.hrReviewStatus ?? "Pending";

  if (status !== "Pending") {
    return { canApproveHead: false, canApproveFinal: false, canApproveHr: false, canReject: false };
  }

  const canHead = canApproveLeaveAsHead(access, leave, staff, resolvedHeadApproverId);
  const canFinal =
    finalAuthorityId && access.staffId
      ? access.staffId === finalAuthorityId || isDirectorOrAdmin(access as any)
      : isDirectorOrAdmin(access as any);
  const canHr = isHrReviewer(access);

  if (headStatus === "Pending") {
    return {
      canApproveHead: canHead,
      canApproveFinal: false,
      canApproveHr: false,
      canReject: canHead,
    };
  }

  if (headStatus === "Approved" && finalAuthorityId && finalStatus === "Pending") {
    return {
      canApproveHead: false,
      canApproveFinal: Boolean(canFinal),
      canApproveHr: false,
      canReject: Boolean(canFinal),
    };
  }

  if (headStatus === "Approved" && finalStatus === "Approved" && hrStatus === "Pending") {
    return {
      canApproveHead: false,
      canApproveFinal: false,
      canApproveHr: canHr,
      canReject: canHr,
    };
  }

  return { canApproveHead: false, canApproveFinal: false, canApproveHr: false, canReject: false };
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
