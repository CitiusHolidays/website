import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { type AuthIdentityLike, authIdentityCandidates } from "../../lib/authIdentity";
import { isBootstrapAdmin as isActiveBootstrapAdmin } from "../../lib/bootstrapAuthority";
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

async function resolveActiveStaff(ctx: QueryCtx | MutationCtx, identity: AuthIdentityLike) {
  // Staff access is an authorization decision. An email match alone is not
  // proof that this auth subject was provisioned for the staff record; public
  // customer signup/profile sync must never be able to claim a staff role.
  const candidates = authIdentityCandidates(identity);
  const matchesByCandidate = await Promise.all(
    candidates.map((candidate) =>
      ctx.db
        .query("staffUsers")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", candidate))
        .take(2)
    )
  );
  const matches = Array.from(
    new Map(matchesByCandidate.flat().map((staff) => [String(staff._id), staff])).values()
  );
  if (matches.length === 1 && matches[0]?.active) {
    return matches[0];
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

  // Break-glass Admin access is fail-closed: an allowlisted email is not enough
  // without a future PORTAL_BOOTSTRAP_ADMINS_EXPIRES_AT value.
  if (email && isActiveBootstrapAdmin(email)) {
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
