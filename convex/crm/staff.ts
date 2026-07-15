import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { syncAuthRecords } from "../lib/authSync";
import {
  ALL_ROLES,
  getPortalAccess,
  normalizeEmail,
  PERMISSIONS,
  requireAnyPermission,
  requireHeadOrAdmin,
  requireStaff,
  TEAM_PICKER_PERMISSIONS,
} from "./lib";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  mapInBoundedBatches,
} from "./paginationPolicy";
import {
  accountsStaffListResultValidator,
  portalAccessResultValidator,
  staffDirectoryListPageResultValidator,
  staffIdResultValidator,
  staffListPageResultValidator,
  staffUpsertResultValidator,
} from "./staffSettingsReturnContracts";

const validRoleSet = new Set<string>(ALL_ROLES);

const sanitizeRoles = (roles: string[]) => {
  const clean = Array.from(new Set(roles.filter((role) => validRoleSet.has(role))));
  if (clean.length === 0) {
    throw new ConvexError("At least one valid role is required");
  }
  return clean;
};

function onboardingStatus(staff: { authUserId?: string; pendingPasswordSetup?: boolean }) {
  if (!staff.authUserId) {
    return "not_started" as const;
  }
  return staff.pendingPasswordSetup ? ("pending" as const) : ("ready" as const);
}

export const getMyPortalAccess = query({
  args: {},
  handler: async (ctx) => await getPortalAccess(ctx),
  returns: portalAccessResultValidator,
});

export const listStaff = query({
  args: {
    active: v.optional(v.boolean()),
    department: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    const page = await applyCrmCursorFilters(
      ctx.db.query("staffUsers").withIndex("by_name").order("asc"),
      { equals: { active: args.active, department: args.department } }
    ).paginate(boundedPaginationOptions(args.paginationOpts));
    const rows = page.page;
    const approverIds = [
      ...new Set(
        rows
          .map((member) => member.leaveHeadApproverId)
          .filter((id): id is NonNullable<typeof id> => id != null)
      ),
    ];
    const approvers = await mapInBoundedBatches(approverIds, async (id) => await ctx.db.get(id));
    const approverNameById = new Map(
      approverIds.map((id, index) => [id, approvers[index]?.name ?? ""])
    );
    return {
      ...page,
      page: rows.map((staff) => ({
        active: staff.active,
        authLinked: Boolean(staff.authUserId),
        confirmationDate: staff.confirmationDate ?? "",
        createdAt: new Date(staff.createdAt).toISOString(),
        department: staff.department ?? "",
        email: staff.email,
        emailAlertRoles: staff.emailAlertRoles ?? [],
        employmentStatus: staff.employmentStatus ?? "Confirmed",
        function: staff.function ?? "",
        id: staff._id,
        joiningDate: staff.joiningDate ?? "",
        leaveEscalationApproverName: staff.leaveEscalationApproverName ?? "",
        leaveEscalationApproverStaffId: staff.leaveEscalationApproverStaffId ?? "",
        leaveFinalAuthorityName: staff.leaveFinalAuthorityName ?? "",
        leaveFinalAuthorityStaffId: staff.leaveFinalAuthorityStaffId ?? "",
        leaveHeadApproverId: staff.leaveHeadApproverId ?? "",
        leaveHeadApproverName: staff.leaveHeadApproverId
          ? (approverNameById.get(staff.leaveHeadApproverId) ?? "")
          : "",
        leaveHrCopyName: staff.leaveHrCopyName ?? "",
        leaveHrCopyStaffId: staff.leaveHrCopyStaffId ?? "",
        leaveLevel1ApproverName: staff.leaveLevel1ApproverName ?? "",
        leaveLevel1ApproverStaffId: staff.leaveLevel1ApproverStaffId ?? "",
        leavePolicyGroup: staff.leavePolicyGroup ?? "",
        location: staff.location ?? "",
        marriageLeaveUsed: staff.marriageLeaveUsed ?? false,
        maternityEventsUsed: staff.maternityEventsUsed ?? 0,
        mobile: staff.mobile ?? "",
        name: staff.name,
        onboardingStatus: onboardingStatus(staff),
        paternityEventsUsed: staff.paternityEventsUsed ?? 0,
        pendingOnboarding: Boolean(staff.pendingPasswordSetup),
        reportingManagerName: staff.reportingManagerName ?? "",
        reportingManagerStaffId: staff.reportingManagerStaffId ?? "",
        roles: staff.roles,
        updatedAt: new Date(staff.updatedAt).toISOString(),
      })),
    };
  },
  returns: staffListPageResultValidator,
});

export const listDirectory = query({
  args: {
    department: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const [access, offices, page] = await Promise.all([
      requireAnyPermission(ctx, [PERMISSIONS.VIEW_TEAM]),
      ctx.db.query("offices").take(100),
      applyCrmCursorFilters(ctx.db.query("staffUsers").withIndex("by_name").order("asc"), {
        equals: { active: true, department: args.department },
      }).paginate(boundedPaginationOptions(args.paginationOpts)),
    ]);
    const officeNames = new Map(offices.map((office) => [office._id, office.name]));
    return {
      ...page,
      page: page.page.map((staff) => ({
        confirmationDate: staff.confirmationDate ?? "",
        department: staff.department ?? staff.roles[0] ?? "",
        email: staff.email,
        employmentStatus: staff.employmentStatus ?? "Confirmed",
        function: staff.function ?? staff.roles.join(", "),
        id: staff._id,
        isCurrentUser: access.staffId
          ? staff._id === access.staffId
          : normalizeEmail(staff.email) === normalizeEmail(access.email),
        joiningDate: staff.joiningDate ?? "",
        leaveEscalationApproverName: staff.leaveEscalationApproverName ?? "",
        leaveEscalationApproverStaffId: staff.leaveEscalationApproverStaffId ?? "",
        leaveFinalAuthorityName: staff.leaveFinalAuthorityName ?? "",
        leaveFinalAuthorityStaffId: staff.leaveFinalAuthorityStaffId ?? "",
        leaveHrCopyName: staff.leaveHrCopyName ?? "",
        leaveHrCopyStaffId: staff.leaveHrCopyStaffId ?? "",
        leaveLevel1ApproverName: staff.leaveLevel1ApproverName ?? "",
        leaveLevel1ApproverStaffId: staff.leaveLevel1ApproverStaffId ?? "",
        leavePolicyGroup: staff.leavePolicyGroup ?? "",
        location: staff.location ?? (staff.officeId ? officeNames.get(staff.officeId) : "") ?? "",
        mobile: staff.mobile ?? "",
        name: staff.name,
        reportingManagerName: staff.reportingManagerName ?? "",
        reportingManagerStaffId: staff.reportingManagerStaffId ?? "",
        roles: staff.roles,
      })),
    };
  },
  returns: staffDirectoryListPageResultValidator,
});

/** Minimal staff list for assignment dropdowns (Sales query SPOC, modals) without full team-directory access. */
export const listTeamOptions = query({
  args: {},
  handler: async (ctx) => {
    await requireAnyPermission(ctx, [...TEAM_PICKER_PERMISSIONS]);
    const rows = await ctx.db.query("staffUsers").collect();
    return rows
      .filter((staff) => staff.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((staff) => ({
        department: staff.department ?? staff.roles[0] ?? "",
        email: staff.email,
        employmentStatus: staff.employmentStatus ?? "Confirmed",
        function: staff.function ?? staff.roles.join(", "),
        id: staff._id,
        joiningDate: staff.joiningDate ?? "",
        location: staff.location ?? "",
        mobile: staff.mobile ?? "",
        name: staff.name,
        roles: staff.roles,
      }));
  },
  returns: v.array(
    v.object({
      department: v.string(),
      email: v.string(),
      employmentStatus: v.string(),
      function: v.string(),
      id: v.id("staffUsers"),
      joiningDate: v.string(),
      location: v.string(),
      mobile: v.string(),
      name: v.string(),
      roles: v.array(v.string()),
    })
  ),
});

export const listAccountsForJobCards = query({
  args: {},
  handler: async (ctx) => {
    await requireAnyPermission(ctx, [PERMISSIONS.VIEW_JOB_CARDS]);
    const rows = await ctx.db.query("staffUsers").collect();
    return rows
      .filter(
        (staff) =>
          staff.active && staff.roles.some((role) => ["Accounts", "Accounts Head"].includes(role))
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((staff) => ({
        email: staff.email,
        id: staff._id,
        jobCardCreatorEnabled: Boolean(staff.jobCardCreatorEnabled),
        name: staff.name,
        roles: staff.roles,
      }));
  },
  returns: accountsStaffListResultValidator,
});

export const setJobCardCreatorAccess = mutation({
  args: {
    enabled: v.boolean(),
    staffId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireHeadOrAdmin(ctx, ["Accounts Head"]);
    const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
    if (!staffId) {
      throw new ConvexError("Invalid staff id");
    }
    const staff = await ctx.db.get(staffId);
    if (!staff?.active) {
      throw new ConvexError("Staff member not found");
    }
    if (!staff.roles.some((role) => ["Accounts", "Accounts Head"].includes(role))) {
      throw new ConvexError("Selected staff member is not in Accounts");
    }
    await ctx.db.patch(staffId, {
      jobCardCreatorEnabled: args.enabled,
      updatedAt: Date.now(),
    });
    return { id: staffId };
  },
  returns: staffIdResultValidator,
});

export const upsertStaff = mutation({
  args: {
    active: v.boolean(),
    confirmationDate: v.optional(v.string()),
    department: v.optional(v.string()),
    email: v.string(),
    emailAlertRoles: v.optional(v.array(v.string())),
    employmentStatus: v.optional(v.union(v.literal("Probationer"), v.literal("Confirmed"))),
    function: v.optional(v.string()),
    joiningDate: v.optional(v.string()),
    leaveHeadApproverId: v.optional(v.string()),
    leavePolicyGroup: v.optional(v.string()),
    location: v.optional(v.string()),
    marriageLeaveUsed: v.optional(v.boolean()),
    maternityEventsUsed: v.optional(v.number()),
    mobile: v.optional(v.string()),
    name: v.string(),
    paternityEventsUsed: v.optional(v.number()),
    reportingManagerName: v.optional(v.string()),
    reportingManagerStaffId: v.optional(v.string()),
    roles: v.array(v.string()),
    staffId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    const emailNormalized = normalizeEmail(args.email);
    if (!emailNormalized?.includes("@")) {
      throw new ConvexError("A valid email is required");
    }

    const roles = sanitizeRoles(args.roles);
    const emailAlertRoles = args.emailAlertRoles?.length ? sanitizeRoles(args.emailAlertRoles) : [];
    const leaveHeadApproverId = args.leaveHeadApproverId
      ? ctx.db.normalizeId("staffUsers", args.leaveHeadApproverId)
      : null;
    if (args.leaveHeadApproverId && !leaveHeadApproverId) {
      throw new ConvexError("Invalid leave head approver");
    }
    if (leaveHeadApproverId) {
      const approver = await ctx.db.get(leaveHeadApproverId);
      if (!approver?.active) {
        throw new ConvexError("Leave head approver must be an active staff member");
      }
    }
    const reportingManagerStaffId = args.reportingManagerStaffId
      ? ctx.db.normalizeId("staffUsers", args.reportingManagerStaffId)
      : null;
    if (args.reportingManagerStaffId && !reportingManagerStaffId) {
      throw new ConvexError("Invalid reporting manager");
    }
    const reportingManager = reportingManagerStaffId
      ? await ctx.db.get(reportingManagerStaffId)
      : null;
    if (reportingManagerStaffId && !reportingManager?.active) {
      throw new ConvexError("Reporting manager must be an active staff member");
    }
    const reportingManagerName =
      reportingManager?.name?.trim() || args.reportingManagerName?.trim() || "";
    const now = Date.now();
    const existingByEmail = await ctx.db
      .query("staffUsers")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", emailNormalized))
      .unique();
    const normalizedStaffId = args.staffId ? ctx.db.normalizeId("staffUsers", args.staffId) : null;

    if (normalizedStaffId) {
      const current = await ctx.db.get(normalizedStaffId);
      if (!current) {
        throw new ConvexError("Staff member not found");
      }
      if (existingByEmail && existingByEmail._id !== normalizedStaffId) {
        throw new ConvexError("Email is already assigned to another staff member");
      }

      await ctx.db.patch(normalizedStaffId, {
        active: args.active,
        confirmationDate: args.confirmationDate || "",
        department: args.department?.trim() || "",
        email: args.email.trim(),
        emailAlertRoles: emailAlertRoles as any,
        emailNormalized,
        employmentStatus: args.employmentStatus ?? "Confirmed",
        function: args.function?.trim() || "",
        joiningDate: args.joiningDate || "",
        leaveHeadApproverId: leaveHeadApproverId ?? undefined,
        leavePolicyGroup: args.leavePolicyGroup?.trim() || "",
        location: args.location?.trim() || "",
        marriageLeaveUsed: args.marriageLeaveUsed ?? false,
        maternityEventsUsed: Math.max(args.maternityEventsUsed ?? 0, 0),
        mobile: args.mobile?.trim() || "",
        name: args.name.trim(),
        paternityEventsUsed: Math.max(args.paternityEventsUsed ?? 0, 0),
        reportingManagerName,
        reportingManagerStaffId: reportingManagerStaffId ?? undefined,
        roles: roles as any,
        updatedAt: now,
      });

      return { created: false, id: normalizedStaffId };
    }

    if (existingByEmail) {
      await ctx.db.patch(existingByEmail._id, {
        active: args.active,
        confirmationDate: args.confirmationDate || "",
        department: args.department?.trim() || "",
        emailAlertRoles: emailAlertRoles as any,
        employmentStatus: args.employmentStatus ?? "Confirmed",
        function: args.function?.trim() || "",
        joiningDate: args.joiningDate || "",
        leaveHeadApproverId: leaveHeadApproverId ?? undefined,
        leavePolicyGroup: args.leavePolicyGroup?.trim() || "",
        location: args.location?.trim() || "",
        marriageLeaveUsed: args.marriageLeaveUsed ?? false,
        maternityEventsUsed: Math.max(args.maternityEventsUsed ?? 0, 0),
        mobile: args.mobile?.trim() || "",
        name: args.name.trim(),
        paternityEventsUsed: Math.max(args.paternityEventsUsed ?? 0, 0),
        reportingManagerName,
        reportingManagerStaffId: reportingManagerStaffId ?? undefined,
        roles: roles as any,
        updatedAt: now,
      });
      return { created: false, id: existingByEmail._id };
    }

    const id = await ctx.db.insert("staffUsers", {
      active: args.active,
      confirmationDate: args.confirmationDate || "",
      createdAt: now,
      department: args.department?.trim() || "",
      email: args.email.trim(),
      emailAlertRoles: emailAlertRoles as any,
      emailNormalized,
      employmentStatus: args.employmentStatus ?? "Confirmed",
      function: args.function?.trim() || "",
      invitedBy: access.authUserId,
      joiningDate: args.joiningDate || "",
      leaveHeadApproverId: leaveHeadApproverId ?? undefined,
      leavePolicyGroup: args.leavePolicyGroup?.trim() || "",
      location: args.location?.trim() || "",
      marriageLeaveUsed: args.marriageLeaveUsed ?? false,
      maternityEventsUsed: Math.max(args.maternityEventsUsed ?? 0, 0),
      mobile: args.mobile?.trim() || "",
      name: args.name.trim(),
      paternityEventsUsed: Math.max(args.paternityEventsUsed ?? 0, 0),
      pendingPasswordSetup: true,
      reportingManagerName,
      reportingManagerStaffId: reportingManagerStaffId ?? undefined,
      roles: roles as any,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.crm.staffAction.provisionStaffUser, {
      email: args.email.trim(),
      name: args.name.trim(),
      staffId: id,
    });

    return { created: true, id };
  },
  returns: staffUpsertResultValidator,
});

export const removeStaff = mutation({
  args: {
    staffId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
    if (!staffId) {
      throw new ConvexError("Invalid staff id");
    }
    const staff = await ctx.db.get(staffId);
    if (!staff) {
      throw new ConvexError("Staff member not found");
    }
    if (staff.emailNormalized === normalizeEmail(access.email)) {
      throw new ConvexError("You cannot delete your own staff access");
    }
    await ctx.db.delete(staffId);
    return { id: staffId };
  },
  returns: staffIdResultValidator,
});

export const linkAuthUserId = internalMutation({
  args: {
    authUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    staffId: v.id("staffUsers"),
  },
  handler: async (ctx, args) => {
    const staff = await ctx.db.get(args.staffId);
    if (!staff) {
      return;
    }

    await ctx.db.patch(args.staffId, {
      authUserId: args.authUserId,
      updatedAt: Date.now(),
    });

    await syncAuthRecords(ctx, {
      authUserId: args.authUserId,
      email: args.email ?? staff.email,
      name: args.name ?? staff.name,
    });
  },
});

export const getStaffForOnboarding = internalQuery({
  args: {
    staffId: v.id("staffUsers"),
  },
  handler: async (ctx, args) => {
    const staff = await ctx.db.get(args.staffId);
    if (!staff) {
      return null;
    }
    return {
      authUserId: staff.authUserId,
      email: staff.email,
      name: staff.name,
      pendingPasswordSetup: staff.pendingPasswordSetup ?? false,
      staffId: staff._id,
    };
  },
});

export const markPendingOnboarding = internalMutation({
  args: {
    staffId: v.id("staffUsers"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.staffId, {
      pendingPasswordSetup: true,
      updatedAt: Date.now(),
    });
  },
});

export const getStaffPendingPasswordSetup = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const emailNormalized = normalizeEmail(args.email);
    const staff = await ctx.db
      .query("staffUsers")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", emailNormalized))
      .unique();
    if (!staff || staff.pendingPasswordSetup === false) {
      return null;
    }
    return {
      authUserId: staff.authUserId,
      email: staff.email,
      name: staff.name,
      pendingPasswordSetup: staff.pendingPasswordSetup ?? true,
      staffId: staff._id,
    };
  },
});

export const clearPendingPasswordSetup = internalMutation({
  args: {
    staffId: v.id("staffUsers"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.staffId, {
      pendingPasswordSetup: false,
      updatedAt: Date.now(),
    });
  },
});
