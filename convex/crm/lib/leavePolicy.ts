import { PERMISSIONS } from "./rolePolicy";
import { hasRole, isDirectorOrAdmin, type PortalAccess } from "./staffAccess";

export function getHeadReviewerRolesForStaff(staff: { roles?: string[]; department?: string }) {
  const roles = new Set(staff.roles ?? []);
  const department = (staff.department ?? "").toLowerCase();
  const reviewerRoles: string[] = [];
  if (roles.has("Sales") || department.includes("sales")) {
    reviewerRoles.push("Sales Head");
  }
  if (roles.has("Contracting") || department.includes("contracting")) {
    reviewerRoles.push("Contracting Head");
  }
  if (
    roles.has("Operations") ||
    roles.has("Tour Manager") ||
    department.includes("operation") ||
    department.includes("tour")
  ) {
    reviewerRoles.push("Operations Head");
  }
  if (roles.has("Ticketing") || department.includes("ticket")) {
    reviewerRoles.push("Head of Ticketing");
  }
  return Array.from(new Set(reviewerRoles.length > 0 ? reviewerRoles : ["HR"]));
}

export function isHrReviewer(access: PortalAccess) {
  return (
    isDirectorOrAdmin(access) ||
    hasRole(access, "HR") ||
    access.permissions.includes(PERMISSIONS.MANAGE_LEAVE)
  );
}

export function canHeadReview(access: PortalAccess, reviewerRole: string) {
  return isDirectorOrAdmin(access) || hasRole(access, reviewerRole);
}

export function canActAsLeaveHeadReviewer(access: PortalAccess, reviewerRole: string) {
  if (reviewerRole === "HR") {
    return isHrReviewer(access);
  }
  return canHeadReview(access, reviewerRole);
}

export function getLeaveApprovalActions(
  access: PortalAccess,
  leave: {
    status?: string;
    headReviewStatus?: string;
    hrReviewStatus?: string;
    headReviewerRole?: string;
  },
  staff: { roles?: string[]; department?: string }
) {
  const status = leave.status ?? "Pending";
  const headStatus = leave.headReviewStatus ?? "Pending";
  const hrStatus = leave.hrReviewStatus ?? "Pending";
  const reviewerRole = leave.headReviewerRole ?? getHeadReviewerRolesForStaff(staff)[0] ?? "HR";

  if (status !== "Pending") {
    return { canApproveHead: false, canApproveHr: false, canReject: false };
  }

  const canHead = canActAsLeaveHeadReviewer(access, reviewerRole);
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
