import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { getRolePermissions, HEAD_ROLES } from "./rolePolicy";

export function isDefined<T>(value: T | null | undefined | false): value is T {
  return value != null && value !== false;
}

export function normalizeEmail(email?: string | null) {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

export type PortalAccess = {
  allowed: boolean;
  reason?: "UNAUTHENTICATED" | "NOT_STAFF";
  staffId?: Id<"staffUsers">;
  bootstrap?: boolean;
  authUserId?: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
};

function getBootstrapAdminEmails() {
  return (process.env.PORTAL_BOOTSTRAP_ADMINS ?? "").split(",").flatMap((email) => {
    const normalized = normalizeEmail(email);
    return normalized ? [normalized] : [];
  });
}

function isBootstrapAdmin(email: string) {
  return getBootstrapAdminEmails().includes(normalizeEmail(email));
}

async function resolveActiveStaff(
  ctx: QueryCtx | MutationCtx,
  identity: { subject: string; email?: string | null; name?: string | null }
) {
  if (identity.subject) {
    const byAuth = await ctx.db
      .query("staffUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
      .unique();
    if (byAuth?.active) {
      return byAuth;
    }
  }

  const email = normalizeEmail(identity.email);
  if (email) {
    const byEmail = await ctx.db
      .query("staffUsers")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", email))
      .unique();
    if (byEmail?.active) {
      return byEmail;
    }
  }

  return null;
}

export async function getPortalAccess(ctx: QueryCtx | MutationCtx): Promise<PortalAccess> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return {
      allowed: false,
      email: "",
      name: "",
      permissions: [],
      reason: "UNAUTHENTICATED",
      roles: [],
    };
  }

  const email = normalizeEmail(identity.email);
  const staff = await resolveActiveStaff(ctx, identity);

  if (staff) {
    const permissions = getRolePermissions(staff.roles);
    return {
      allowed: true,
      authUserId: identity.subject,
      bootstrap: false,
      email: staff.email,
      name: staff.name || identity.name || staff.email,
      permissions,
      roles: staff.roles,
      staffId: staff._id,
    };
  }

  if (email && isBootstrapAdmin(email)) {
    return {
      allowed: true,
      authUserId: identity.subject,
      bootstrap: true,
      email,
      name: identity.name || email,
      permissions: getRolePermissions(["Admin"]),
      roles: ["Admin"],
    };
  }

  return {
    allowed: false,
    authUserId: identity.subject,
    email,
    name: identity.name || email,
    permissions: [],
    reason: "NOT_STAFF",
    roles: [],
  };
}

export async function requireStaff(ctx: QueryCtx | MutationCtx, permission?: string) {
  const access = await getPortalAccess(ctx);
  if (!access.allowed) {
    throw new ConvexError("FORBIDDEN");
  }
  if (permission && !access.permissions.includes(permission)) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
}

export async function requireAnyPermission(ctx: QueryCtx | MutationCtx, permissions: string[]) {
  const access = await requireStaff(ctx);
  const permissionSet = new Set(access.permissions);
  if (!permissions.some((permission) => permissionSet.has(permission))) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
}

export function hasRole(access: PortalAccess, role: string) {
  return access.roles.includes(role);
}

export function isAdmin(access: PortalAccess) {
  return hasRole(access, "Admin");
}

export function isDirectorOrAdmin(access: PortalAccess) {
  return isAdmin(access) || hasRole(access, "Directors") || hasRole(access, "Director Cement");
}

export function isAdminDirectorOrRole(access: PortalAccess, roles: string[]) {
  return isDirectorOrAdmin(access) || roles.some((role) => hasRole(access, role));
}

export function isHead(access: PortalAccess) {
  return HEAD_ROLES.some((role) => hasRole(access, role));
}

export async function requireHeadOrAdmin(ctx: QueryCtx | MutationCtx, headRoles: string[]) {
  const access = await requireStaff(ctx);
  if (isDirectorOrAdmin(access)) {
    return access;
  }
  if (!headRoles.some((role) => hasRole(access, role))) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
}
