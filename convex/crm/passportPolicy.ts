import type { JobCardRecordGrant } from "./lib/recordScope";
import { getRolePermissions, PERMISSIONS } from "./lib/rolePolicy";
import type { PortalAccess } from "./lib/staffAccess";

const TOUR_MANAGER_ROLE = "Tour Manager";

/** True when a role other than Tour Manager grants the permission. */
export function holdsPermissionOutsideTourManagerRole(
  roles: readonly string[],
  permission: string
) {
  return getRolePermissions(roles.filter((role) => role !== TOUR_MANAGER_ROLE)).includes(
    permission
  );
}

/**
 * Staff Workspace passport scans and metadata need two things: office access to the Job Card
 * and passport read authority from an office role. The Tour Manager role alone never opens a
 * passport in the CRM (owner decision, 6 Nov 2026). Tour managers read their own group's
 * passports from the field through `crm/fieldPassportActions`, inside the trip window.
 */
export function canReadPassportInStaffWorkspace(
  access: Pick<PortalAccess, "externalTourManager" | "roles">,
  grant: JobCardRecordGrant | null
) {
  // An external tour manager's login never reads passport data in the CRM, whatever it holds.
  if (access.externalTourManager === true) {
    return false;
  }
  return (
    grant === "office" && holdsPermissionOutsideTourManagerRole(access.roles, PERMISSIONS.VIEW_VISA)
  );
}

/**
 * Passport expiry dates are wider than scans: Ticketing needs them to book and check fares
 * (owner decision, 7 Nov 2026), so visa or ticketing read authority from an office role is
 * enough. Scans and numbers still need `canReadPassportInStaffWorkspace`.
 */
export function holdsPassportExpiryAuthority(roles: readonly string[]) {
  return (
    holdsPermissionOutsideTourManagerRole(roles, PERMISSIONS.VIEW_VISA) ||
    holdsPermissionOutsideTourManagerRole(roles, PERMISSIONS.VIEW_TICKETING)
  );
}

export function canReadPassportExpiryInStaffWorkspace(
  access: Pick<PortalAccess, "roles">,
  grant: JobCardRecordGrant | null
) {
  return grant === "office" && holdsPassportExpiryAuthority(access.roles);
}
