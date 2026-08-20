import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { syncAuthRecords } from "../lib/authSync";
import { getBootstrapAuthorityExpiry } from "../lib/bootstrapAuthority";
import {
  type ALL_ROLES,
  getPortalAccess,
  isStaffRole,
  normalizeEmail,
  PERMISSIONS,
  requireAnyPermission,
  requireHeadOrAdmin,
  requireStaff,
  TEAM_PICKER_PERMISSIONS,
} from "./lib";
import { createActivity } from "./lib/activity";
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
  staffOnboardingRecordResultValidator,
  staffUpsertResultValidator,
} from "./staffSettingsReturnContracts";

const sanitizeRoles = (roles: string[]) => {
  const clean = Array.from(new Set(roles.filter(isStaffRole)));
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

function staffText(value: string | null | undefined) {
  return value ?? "";
}

function presentStaffRow(
  staff: Doc<"staffUsers">,
  approverNameById: Map<Id<"staffUsers">, string>
) {
  return {
    active: staff.active,
    authLinked: Boolean(staff.authUserId),
    confirmationDate: staffText(staff.confirmationDate),
    createdAt: new Date(staff.createdAt).toISOString(),
    department: staffText(staff.department),
    email: staff.email,
    emailAlertRoles: staff.emailAlertRoles ?? [],
    employmentStatus: staff.employmentStatus ?? "Confirmed",
    function: staffText(staff.function),
    id: staff._id,
    joiningDate: staffText(staff.joiningDate),
    leaveEscalationApproverName: staffText(staff.leaveEscalationApproverName),
    leaveEscalationApproverStaffId: staffText(staff.leaveEscalationApproverStaffId),
    leaveFinalAuthorityName: staffText(staff.leaveFinalAuthorityName),
    leaveFinalAuthorityStaffId: staffText(staff.leaveFinalAuthorityStaffId),
    leaveHeadApproverId: staffText(staff.leaveHeadApproverId),
    leaveHeadApproverName: staff.leaveHeadApproverId
      ? staffText(approverNameById.get(staff.leaveHeadApproverId))
      : "",
    leaveHrCopyName: staffText(staff.leaveHrCopyName),
    leaveHrCopyStaffId: staffText(staff.leaveHrCopyStaffId),
    leaveLevel1ApproverName: staffText(staff.leaveLevel1ApproverName),
    leaveLevel1ApproverStaffId: staffText(staff.leaveLevel1ApproverStaffId),
    leavePolicyGroup: staffText(staff.leavePolicyGroup),
    location: staffText(staff.location),
    marriageLeaveUsed: staff.marriageLeaveUsed ?? false,
    maternityEventsUsed: staff.maternityEventsUsed ?? 0,
    mobile: staffText(staff.mobile),
    name: staff.name,
    onboardingStatus: onboardingStatus(staff),
    paternityEventsUsed: staff.paternityEventsUsed ?? 0,
    pendingOnboarding: Boolean(staff.pendingPasswordSetup),
    reportingManagerName: staffText(staff.reportingManagerName),
    reportingManagerStaffId: staffText(staff.reportingManagerStaffId),
    roles: staff.roles,
    updatedAt: new Date(staff.updatedAt).toISOString(),
  };
}

function presentDirectoryRow(
  staff: Doc<"staffUsers">,
  officeNames: Map<Id<"offices">, string>,
  access: Awaited<ReturnType<typeof requireAnyPermission>>
) {
  const currentUserMatches = access.staffId
    ? staff._id === access.staffId
    : normalizeEmail(staff.email) === normalizeEmail(access.email);
  return {
    confirmationDate: staffText(staff.confirmationDate),
    department: staff.department ?? staff.roles[0] ?? "",
    email: staff.email,
    employmentStatus: staff.employmentStatus ?? "Confirmed",
    function: staff.function ?? staff.roles.join(", "),
    id: staff._id,
    isCurrentUser: currentUserMatches,
    joiningDate: staffText(staff.joiningDate),
    leaveEscalationApproverName: staffText(staff.leaveEscalationApproverName),
    leaveEscalationApproverStaffId: staffText(staff.leaveEscalationApproverStaffId),
    leaveFinalAuthorityName: staffText(staff.leaveFinalAuthorityName),
    leaveFinalAuthorityStaffId: staffText(staff.leaveFinalAuthorityStaffId),
    leaveHrCopyName: staffText(staff.leaveHrCopyName),
    leaveHrCopyStaffId: staffText(staff.leaveHrCopyStaffId),
    leaveLevel1ApproverName: staffText(staff.leaveLevel1ApproverName),
    leaveLevel1ApproverStaffId: staffText(staff.leaveLevel1ApproverStaffId),
    leavePolicyGroup: staffText(staff.leavePolicyGroup),
    location: staff.location ?? (staff.officeId ? officeNames.get(staff.officeId) : "") ?? "",
    mobile: staffText(staff.mobile),
    name: staff.name,
    reportingManagerName: staffText(staff.reportingManagerName),
    reportingManagerStaffId: staffText(staff.reportingManagerStaffId),
    roles: staff.roles,
  };
}

function staffNumber(value: number | undefined) {
  return value ?? 0;
}

async function resolveActiveStaffReference(
  ctx: Parameters<typeof recordBootstrapProvisioning>[0],
  rawId: string | undefined,
  labels: { inactive: string; invalid: string }
) {
  if (!rawId) {
    return null;
  }
  const staffId = ctx.db.normalizeId("staffUsers", rawId);
  if (!staffId) {
    throw new ConvexError(labels.invalid);
  }
  const staff = await ctx.db.get("staffUsers", staffId);
  if (!staff?.active) {
    throw new ConvexError(labels.inactive);
  }
  return staff;
}

function buildStaffPayload(
  args: any,
  options: {
    emailAlertRoles: (typeof ALL_ROLES)[number][];
    emailNormalized: string;
    leaveHeadApproverId?: Id<"staffUsers">;
    now: number;
    reportingManager?: Doc<"staffUsers"> | null;
    roles: (typeof ALL_ROLES)[number][];
  }
) {
  const reportingManagerName =
    options.reportingManager?.name?.trim() || args.reportingManagerName?.trim() || "";
  return {
    active: args.active,
    confirmationDate: staffText(args.confirmationDate),
    department: args.department?.trim() || "",
    email: args.email.trim(),
    emailAlertRoles: options.emailAlertRoles,
    emailNormalized: options.emailNormalized,
    employmentStatus: args.employmentStatus ?? "Confirmed",
    function: args.function?.trim() || "",
    joiningDate: staffText(args.joiningDate),
    leaveHeadApproverId: options.leaveHeadApproverId,
    leavePolicyGroup: args.leavePolicyGroup?.trim() || "",
    location: args.location?.trim() || "",
    marriageLeaveUsed: args.marriageLeaveUsed ?? false,
    maternityEventsUsed: Math.max(staffNumber(args.maternityEventsUsed), 0),
    mobile: args.mobile?.trim() || "",
    name: args.name.trim(),
    paternityEventsUsed: Math.max(staffNumber(args.paternityEventsUsed), 0),
    reportingManagerName,
    reportingManagerStaffId: options.reportingManager?._id,
    roles: options.roles,
    updatedAt: options.now,
  };
}

async function recordBootstrapProvisioning(
  ctx: Parameters<typeof createActivity>[0],
  access: Awaited<ReturnType<typeof requireStaff>>,
  staffId: Id<"staffUsers">,
  action: "bootstrap_staff_created" | "bootstrap_staff_updated"
) {
  if (!access.bootstrap) {
    return;
  }
  await createActivity(ctx, access, {
    action,
    entityId: String(staffId),
    entityType: "staffUser",
    message: "Bootstrap authority changed a staff access record.",
    metadata: {
      bootstrapAuthorityExpiresAt: getBootstrapAuthorityExpiry(),
    },
  });
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
        rows.flatMap((member) => {
          if (!member.leaveHeadApproverId) {
            return [];
          }
          const normalizedId = ctx.db.normalizeId("staffUsers", member.leaveHeadApproverId);
          return normalizedId ? [normalizedId] : [];
        })
      ),
    ];
    const approvers = await mapInBoundedBatches(
      approverIds,
      async (id) => await ctx.db.get("staffUsers", id)
    );
    const approverNameById = new Map(
      approverIds.map((id, index) => [id, approvers[index]?.name ?? ""])
    );
    return {
      ...page,
      page: rows.map((staff) => presentStaffRow(staff, approverNameById)),
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
      page: page.page.map((staff) => presentDirectoryRow(staff, officeNames, access)),
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
    const staff = await ctx.db.get("staffUsers", staffId);
    if (!staff?.active) {
      throw new ConvexError("Staff member not found");
    }
    if (!staff.roles.some((role) => ["Accounts", "Accounts Head"].includes(role))) {
      throw new ConvexError("Selected staff member is not in Accounts");
    }
    await ctx.db.patch("staffUsers", staffId, {
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
    const [leaveHeadApprover, reportingManager] = await Promise.all([
      resolveActiveStaffReference(ctx, args.leaveHeadApproverId, {
        inactive: "Leave head approver must be an active staff member",
        invalid: "Invalid leave head approver",
      }),
      resolveActiveStaffReference(ctx, args.reportingManagerStaffId, {
        inactive: "Reporting manager must be an active staff member",
        invalid: "Invalid reporting manager",
      }),
    ]);
    const now = Date.now();
    const existingByEmail = await ctx.db
      .query("staffUsers")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", emailNormalized))
      .unique();
    const normalizedStaffId = args.staffId ? ctx.db.normalizeId("staffUsers", args.staffId) : null;
    const payload = buildStaffPayload(args, {
      emailAlertRoles,
      emailNormalized,
      leaveHeadApproverId: leaveHeadApprover?._id,
      now,
      reportingManager,
      roles,
    });

    if (normalizedStaffId) {
      const current = await ctx.db.get("staffUsers", normalizedStaffId);
      if (!current) {
        throw new ConvexError("Staff member not found");
      }
      if (existingByEmail && existingByEmail._id !== normalizedStaffId) {
        throw new ConvexError("Email is already assigned to another staff member");
      }

      await ctx.db.patch("staffUsers", normalizedStaffId, payload);

      await recordBootstrapProvisioning(ctx, access, normalizedStaffId, "bootstrap_staff_updated");

      return { created: false, id: normalizedStaffId };
    }

    if (existingByEmail) {
      await ctx.db.patch("staffUsers", existingByEmail._id, payload);
      await recordBootstrapProvisioning(
        ctx,
        access,
        existingByEmail._id,
        "bootstrap_staff_updated"
      );
      return { created: false, id: existingByEmail._id };
    }

    const id = await ctx.db.insert("staffUsers", {
      ...payload,
      createdAt: now,
      invitedBy: access.authUserId,
      pendingPasswordSetup: true,
    });

    await ctx.scheduler.runAfter(0, internal.crm.staffAction.provisionStaffUser, {
      email: args.email.trim(),
      name: args.name.trim(),
      staffId: id,
    });

    await recordBootstrapProvisioning(ctx, access, id, "bootstrap_staff_created");

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
    const staff = await ctx.db.get("staffUsers", staffId);
    if (!staff) {
      throw new ConvexError("Staff member not found");
    }
    if (staff.emailNormalized === normalizeEmail(access.email)) {
      throw new ConvexError("You cannot delete your own staff access");
    }
    await ctx.db.delete("staffUsers", staffId);
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
    const staff = await ctx.db.get("staffUsers", args.staffId);
    if (!staff) {
      return null;
    }

    await ctx.db.patch("staffUsers", args.staffId, {
      authUserId: args.authUserId,
      updatedAt: Date.now(),
    });

    await syncAuthRecords(ctx, {
      authUserId: args.authUserId,
      email: args.email ?? staff.email,
      name: args.name ?? staff.name,
    });
    return null;
  },
  returns: v.null(),
});

export const getStaffForOnboarding = internalQuery({
  args: {
    staffId: v.id("staffUsers"),
  },
  handler: async (ctx, args) => {
    const staff = await ctx.db.get("staffUsers", args.staffId);
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
  returns: staffOnboardingRecordResultValidator,
});

export const markPendingOnboarding = internalMutation({
  args: {
    staffId: v.id("staffUsers"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("staffUsers", args.staffId, {
      pendingPasswordSetup: true,
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
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
  returns: staffOnboardingRecordResultValidator,
});

export const clearPendingPasswordSetup = internalMutation({
  args: {
    staffId: v.id("staffUsers"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("staffUsers", args.staffId, {
      pendingPasswordSetup: false,
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});
