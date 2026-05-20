import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  ALL_ROLES,
  PERMISSIONS,
  getPortalAccess,
  normalizeEmail,
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
        active: staff.active,
        createdAt: new Date(staff.createdAt).toISOString(),
        updatedAt: new Date(staff.updatedAt).toISOString(),
      }));
  },
});

export const listDirectory = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_TEAM,
      PERMISSIONS.VIEW_CONTRACTING,
    ]);
    const offices = await ctx.db.query("offices").collect();
    const officeNames = new Map(offices.map((office) => [office._id, office.name]));
    const rows = await ctx.db.query("staffUsers").collect();
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
        isCurrentUser: normalizeEmail(staff.email) === normalizeEmail(access.email),
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
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    const emailNormalized = normalizeEmail(args.email);
    if (!emailNormalized || !emailNormalized.includes("@")) {
      throw new ConvexError("A valid email is required");
    }

    const roles = sanitizeRoles(args.roles);
    const now = Date.now();
    const existingByEmail = await ctx.db
      .query("staffUsers")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", emailNormalized))
      .unique();
    const normalizedStaffId = args.staffId
      ? ctx.db.normalizeId("staffUsers", args.staffId)
      : null;

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
        active: args.active,
        updatedAt: now,
      });

      return { id: normalizedStaffId };
    }

    if (existingByEmail) {
      await ctx.db.patch(existingByEmail._id, {
        name: args.name.trim(),
        roles: roles as any,
        department: args.department?.trim() || "",
        function: args.function?.trim() || "",
        mobile: args.mobile?.trim() || "",
        location: args.location?.trim() || "",
        active: args.active,
        updatedAt: now,
      });
      return { id: existingByEmail._id };
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
      active: args.active,
      invitedBy: access.authUserId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.crm.staffAction.provisionStaffUser, {
      staffId: id,
      email: args.email.trim(),
      name: args.name.trim(),
    });

    return { id };
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
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.staffId, {
      authUserId: args.authUserId,
      updatedAt: Date.now(),
    });
  },
});
