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
  requireStaff,
} from "./lib";

const validRoleSet = new Set<string>(ALL_ROLES);

const sanitizeRoles = (roles: string[]) => {
  const clean = Array.from(new Set(roles.filter((role) => validRoleSet.has(role))));
  if (clean.length === 0) {
    throw new ConvexError("At least one valid role is required");
  }
  return clean;
};

export const getMyPortalAccess = query({
  args: {},
  handler: async (ctx) => {
    return await getPortalAccess(ctx);
  },
});

export const listStaff = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    const rows = await ctx.db.query("staffUsers").collect();
    const approverIds = [
      ...new Set(
        rows
          .map((member) => member.leaveHeadApproverId)
          .filter((id): id is NonNullable<typeof id> => id != null),
      ),
    ];
    const approvers = await Promise.all(approverIds.map((id) => ctx.db.get(id)));
    const approverNameById = new Map(
      approverIds.map((id, index) => [id, approvers[index]?.name ?? ""]),
    );
    return rows
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((staff) => ({
        id: staff._id,
        email: staff.email,
        name: staff.name,
        roles: staff.roles,
        department: staff.department ?? "",
        function: staff.function ?? "",
        mobile: staff.mobile ?? "",
        location: staff.location ?? "",
        joiningDate: staff.joiningDate ?? "",
        employmentStatus: staff.employmentStatus ?? "Confirmed",
        confirmationDate: staff.confirmationDate ?? "",
        leavePolicyGroup: staff.leavePolicyGroup ?? "",
        leaveHeadApproverId: staff.leaveHeadApproverId ?? "",
        leaveHeadApproverName: staff.leaveHeadApproverId
          ? (approverNameById.get(staff.leaveHeadApproverId) ?? "")
          : "",
        reportingManagerName: staff.reportingManagerName ?? "",
        reportingManagerStaffId: staff.reportingManagerStaffId ?? "",
        maternityEventsUsed: staff.maternityEventsUsed ?? 0,
        paternityEventsUsed: staff.paternityEventsUsed ?? 0,
        marriageLeaveUsed: staff.marriageLeaveUsed ?? false,
        active: staff.active,
        authLinked: Boolean(staff.authUserId),
        pendingOnboarding: Boolean(staff.pendingPasswordSetup),
        onboardingStatus: !staff.authUserId
          ? "not_started"
          : staff.pendingPasswordSetup
            ? "pending"
            : "ready",
        createdAt: new Date(staff.createdAt).toISOString(),
        updatedAt: new Date(staff.updatedAt).toISOString(),
      }));
  },
});

export const listDirectory = query({
  args: {},
  handler: async (ctx) => {
    const [access, offices, rows] = await Promise.all([
      requireAnyPermission(ctx, [PERMISSIONS.VIEW_TEAM]),
      ctx.db.query("offices").collect(),
      ctx.db.query("staffUsers").collect(),
    ]);
    const officeNames = new Map(offices.map((office) => [office._id, office.name]));
    return rows
      .filter((staff) => staff.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((staff) => ({
        id: staff._id,
        email: staff.email,
        name: staff.name,
        roles: staff.roles,
        department: staff.department ?? staff.roles[0] ?? "",
        function: staff.function ?? staff.roles.join(", "),
        mobile: staff.mobile ?? "",
        location: staff.location ?? (staff.officeId ? officeNames.get(staff.officeId) : "") ?? "",
        joiningDate: staff.joiningDate ?? "",
        employmentStatus: staff.employmentStatus ?? "Confirmed",
        confirmationDate: staff.confirmationDate ?? "",
        leavePolicyGroup: staff.leavePolicyGroup ?? "",
        reportingManagerName: staff.reportingManagerName ?? "",
        reportingManagerStaffId: staff.reportingManagerStaffId ?? "",
        isCurrentUser: access.staffId
          ? staff._id === access.staffId
          : normalizeEmail(staff.email) === normalizeEmail(access.email),
      }));
  },
});

export const upsertStaff = mutation({
  args: {
    staffId: v.optional(v.string()),
    email: v.string(),
    name: v.string(),
    roles: v.array(v.string()),
    department: v.optional(v.string()),
    function: v.optional(v.string()),
    mobile: v.optional(v.string()),
    location: v.optional(v.string()),
    joiningDate: v.optional(v.string()),
    employmentStatus: v.optional(v.union(v.literal("Probationer"), v.literal("Confirmed"))),
    confirmationDate: v.optional(v.string()),
    leavePolicyGroup: v.optional(v.string()),
    leaveHeadApproverId: v.optional(v.string()),
    reportingManagerStaffId: v.optional(v.string()),
    reportingManagerName: v.optional(v.string()),
    maternityEventsUsed: v.optional(v.number()),
    paternityEventsUsed: v.optional(v.number()),
    marriageLeaveUsed: v.optional(v.boolean()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    const emailNormalized = normalizeEmail(args.email);
    if (!emailNormalized?.includes("@")) {
      throw new ConvexError("A valid email is required");
    }

    const roles = sanitizeRoles(args.roles);
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
        email: args.email.trim(),
        emailNormalized,
        name: args.name.trim(),
        roles: roles as any,
        department: args.department?.trim() || "",
        function: args.function?.trim() || "",
        mobile: args.mobile?.trim() || "",
        location: args.location?.trim() || "",
        joiningDate: args.joiningDate || "",
        employmentStatus: args.employmentStatus ?? "Confirmed",
        confirmationDate: args.confirmationDate || "",
        leavePolicyGroup: args.leavePolicyGroup?.trim() || "",
        leaveHeadApproverId: leaveHeadApproverId ?? undefined,
        reportingManagerName,
        reportingManagerStaffId: reportingManagerStaffId ?? undefined,
        maternityEventsUsed: Math.max(args.maternityEventsUsed ?? 0, 0),
        paternityEventsUsed: Math.max(args.paternityEventsUsed ?? 0, 0),
        marriageLeaveUsed: args.marriageLeaveUsed ?? false,
        active: args.active,
        updatedAt: now,
      });

      return { id: normalizedStaffId, created: false };
    }

    if (existingByEmail) {
      await ctx.db.patch(existingByEmail._id, {
        name: args.name.trim(),
        roles: roles as any,
        department: args.department?.trim() || "",
        function: args.function?.trim() || "",
        mobile: args.mobile?.trim() || "",
        location: args.location?.trim() || "",
        joiningDate: args.joiningDate || "",
        employmentStatus: args.employmentStatus ?? "Confirmed",
        confirmationDate: args.confirmationDate || "",
        leavePolicyGroup: args.leavePolicyGroup?.trim() || "",
        leaveHeadApproverId: leaveHeadApproverId ?? undefined,
        reportingManagerName,
        reportingManagerStaffId: reportingManagerStaffId ?? undefined,
        maternityEventsUsed: Math.max(args.maternityEventsUsed ?? 0, 0),
        paternityEventsUsed: Math.max(args.paternityEventsUsed ?? 0, 0),
        marriageLeaveUsed: args.marriageLeaveUsed ?? false,
        active: args.active,
        updatedAt: now,
      });
      return { id: existingByEmail._id, created: false };
    }

    const id = await ctx.db.insert("staffUsers", {
      email: args.email.trim(),
      emailNormalized,
      name: args.name.trim(),
      roles: roles as any,
      department: args.department?.trim() || "",
      function: args.function?.trim() || "",
      mobile: args.mobile?.trim() || "",
      location: args.location?.trim() || "",
      joiningDate: args.joiningDate || "",
      employmentStatus: args.employmentStatus ?? "Confirmed",
      confirmationDate: args.confirmationDate || "",
      leavePolicyGroup: args.leavePolicyGroup?.trim() || "",
      leaveHeadApproverId: leaveHeadApproverId ?? undefined,
      reportingManagerName,
      reportingManagerStaffId: reportingManagerStaffId ?? undefined,
      maternityEventsUsed: Math.max(args.maternityEventsUsed ?? 0, 0),
      paternityEventsUsed: Math.max(args.paternityEventsUsed ?? 0, 0),
      marriageLeaveUsed: args.marriageLeaveUsed ?? false,
      active: args.active,
      invitedBy: access.authUserId,
      pendingPasswordSetup: true,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.crm.staffAction.provisionStaffUser, {
      staffId: id,
      email: args.email.trim(),
      name: args.name.trim(),
    });

    return { id, created: true };
  },
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
});

export const linkAuthUserId = internalMutation({
  args: {
    staffId: v.id("staffUsers"),
    authUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
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
      staffId: staff._id,
      email: staff.email,
      name: staff.name,
      authUserId: staff.authUserId,
      pendingPasswordSetup: staff.pendingPasswordSetup ?? false,
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
      staffId: staff._id,
      email: staff.email,
      name: staff.name,
      authUserId: staff.authUserId,
      pendingPasswordSetup: staff.pendingPasswordSetup ?? true,
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
