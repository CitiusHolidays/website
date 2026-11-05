import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { env } from "../_generated/server";
import { getHeadReviewerRolesForStaff } from "./lib/leavePolicy";
import { PERMISSIONS } from "./lib/rolePolicy";
import { hasRole, isDirectorOrAdmin, type PortalAccess } from "./lib/staffAccess";
import type { BranchRule } from "./officeCheckInVerification";

type Ctx = QueryCtx | MutationCtx;

/**
 * Who may see and correct another person's check-ins.
 *
 * - Admin, Directors, Director Cement and HR: every office.
 * - Department heads (view:team): same-office staff in their own department,
 *   using the same department-to-head mapping as leave approval, and never
 *   the all-office roles.
 * - Any staff member: their direct reports (reportingManagerStaffId).
 * - Nobody reviews or corrects their own record.
 */
const ALL_OFFICE_ROLES = new Set(["Admin", "Directors", "Director Cement", "HR"]);
export function canOverseeAllOffices(access: PortalAccess) {
  return isDirectorOrAdmin(access) || hasRole(access, "HR");
}

export function canOversee(
  access: PortalAccess,
  actor: Doc<"staffUsers"> | null,
  subject: Doc<"staffUsers">,
  subjectOfficeId: Id<"offices"> | undefined = subject.officeId
) {
  if (access.staffId && access.staffId === subject._id) {
    return false;
  }
  if (canOverseeAllOffices(access)) {
    return true;
  }
  if (!actor) {
    return false;
  }
  if (subject.reportingManagerStaffId === actor._id) {
    return true;
  }
  if (
    !(
      access.permissions.includes(PERMISSIONS.VIEW_TEAM) &&
      actor.officeId &&
      subjectOfficeId === actor.officeId
    ) ||
    subject.roles.some((role) => ALL_OFFICE_ROLES.has(role))
  ) {
    return false;
  }
  return getHeadReviewerRolesForStaff(subject).some((role) => access.roles.includes(role));
}

export function isOverseer(access: PortalAccess) {
  return canOverseeAllOffices(access) || access.permissions.includes(PERMISSIONS.VIEW_TEAM);
}

export async function actorStaff(ctx: Ctx, access: PortalAccess) {
  return access.staffId ? await ctx.db.get("staffUsers", access.staffId) : null;
}

export async function requireOverseenStaff(
  ctx: Ctx,
  access: PortalAccess,
  staffId: Id<"staffUsers">,
  recordOfficeId?: Id<"offices">
) {
  const [actor, subject] = await Promise.all([
    actorStaff(ctx, access),
    ctx.db.get("staffUsers", staffId),
  ]);
  if (!(subject && canOversee(access, actor, subject, recordOfficeId ?? subject.officeId))) {
    throw new ConvexError("FORBIDDEN");
  }
  return { actor, subject };
}

export async function ruleForOffice(ctx: Ctx, officeId: Id<"offices">) {
  return await ctx.db
    .query("officeCheckInRules")
    .withIndex("by_officeId", (q) => q.eq("officeId", officeId))
    .unique();
}

export function toBranchRule(rule: Doc<"officeCheckInRules"> | null): BranchRule | null {
  if (!rule) {
    return null;
  }
  return {
    enforcementMode: rule.enforcementMode,
    geofence: rule.geofence ?? null,
    networks: rule.networks,
    requirement: rule.requirement,
  };
}

/** Compares every position regardless of where the first mismatch is. */
function secretsMatch(left: string, right: string) {
  let mismatches = left.length === right.length ? 0 : 1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatches += left.charCodeAt(index) === right.charCodeAt(index) ? 0 : 1;
  }
  return mismatches === 0;
}

/**
 * The observed IP is accepted only from the Next.js check-in route, which
 * reads it from the edge-set header and holds this shared secret. A browser
 * calling the mutation directly cannot supply a trusted IP.
 */
export function assertCheckInGateway(secret: string) {
  const expected = env.OFFICE_CHECK_IN_GATEWAY_SECRET?.trim();
  if (!(expected && secretsMatch(secret, expected))) {
    // Distinct from FORBIDDEN so a server misconfiguration is not shown to
    // staff as "no access"; the route reports it as unavailable.
    throw new ConvexError("GATEWAY_MISCONFIGURED");
  }
}

export function requireReason(reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 500) {
    throw new ConvexError("A reason between 3 and 500 characters is required.");
  }
  return trimmed;
}
