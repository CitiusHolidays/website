import {
  CEMENT_QUERY_TYPES,
  CEMENT_ROLES,
  PORTAL_NAV_GROUPS,
  PORTAL_PERMISSIONS,
  QUERY_TYPES,
  ROLE_PERMISSIONS,
  TEAM_PICKER_PERMISSIONS,
} from "./constants";

export function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function getPermissionsForRoles(roles = []) {
  const permissions = new Set();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] || []) {
      permissions.add(permission);
    }
  }
  if (roles.length > 0) {
    permissions.add(PORTAL_PERMISSIONS.REQUEST_LEAVE);
    permissions.add(PORTAL_PERMISSIONS.VIEW_EXPENSES);
    permissions.add(PORTAL_PERMISSIONS.CREATE_EXPENSES);
  }
  return Array.from(permissions).sort();
}

/**
 * Passport scans in the Staff Workspace need visa read access from a role other than Tour
 * Manager. Mirrors `canReadPassportInStaffWorkspace` in convex/crm/passportPolicy.ts; the server
 * also requires office scope on the Job Card. Tour managers read their own group's passports in
 * the tour manager app during the trip.
 */
export function canViewPassportScansInWorkspace(access) {
  if (isExternalTourManager(access)) {
    return false;
  }
  const roles = (access?.roles ?? []).filter((role) => role !== "Tour Manager");
  return getPermissionsForRoles(roles).includes(PORTAL_PERMISSIONS.VIEW_VISA);
}

/**
 * Passport expiry dates reach visa and ticketing staff (Ticketing books against them) but never
 * a Tour Manager-only user. Mirrors `holdsPassportExpiryAuthority` in
 * convex/crm/passportPolicy.ts; the server also requires office scope on the Job Card.
 */
export function canViewPassportExpiryInWorkspace(access) {
  if (isExternalTourManager(access)) {
    return false;
  }
  const roles = (access?.roles ?? []).filter((role) => role !== "Tour Manager");
  const permissions = getPermissionsForRoles(roles);
  return (
    permissions.includes(PORTAL_PERMISSIONS.VIEW_VISA) ||
    permissions.includes(PORTAL_PERMISSIONS.VIEW_TICKETING)
  );
}

/**
 * The passport view log (who opened which passport in the tour manager app) is for the
 * Operations Head and Admin only (director decision, 7 Nov 2026). Mirrors
 * `canReadFieldPassportAccessLog` in convex/crm/passportPolicy.ts; the server also requires office
 * scope on the Job Card. A Director, an Operations executive, a tour manager and an external login
 * are refused.
 */
export function canViewFieldPassportAccessLog(access) {
  if (!access?.allowed || isExternalTourManager(access)) {
    return false;
  }
  const roles = access.roles ?? [];
  return roles.includes("Admin") || roles.includes("Operations Head");
}

function hasPermission(access, permission) {
  if (!permission) {
    return true;
  }
  return Boolean(access?.permissions?.includes(permission));
}

export function canAccessPipeline(access) {
  return (
    hasPermission(access, PORTAL_PERMISSIONS.MANAGE_QUERIES) ||
    hasPermission(access, PORTAL_PERMISSIONS.VIEW_CONTRACTING)
  );
}

const INBOUND_LEAD_ROLES = new Set([
  "Sales",
  "Sales Head",
  "Admin",
  "Directors",
  "Director Cement",
]);

function canAccessInboundLeads(access) {
  return Boolean(access?.roles?.some((role) => INBOUND_LEAD_ROLES.has(role)));
}

/**
 * An external tour manager's login (owner decision, 7 Nov 2026). The server narrows its
 * permissions to its assigned trips; the client only hides the pages every employee reaches.
 */
export function isExternalTourManager(access) {
  return Boolean(access?.allowed && access.externalTourManager === true);
}

const STAFF_WIDE_PAGES = new Set(["post-tour-feedback", "travel-schedule"]);
// Post-tour feedback is open to an external login for its own trips (the server narrows it);
// the travel schedule is not.
const EXTERNAL_STAFF_WIDE_PAGES = new Set(["activity", "post-tour-feedback"]);
// Pages an external login never opens even though it holds their permission: passport documents
// (no passport data in the CRM) and the ticket dashboard (no dashboard data).
const EXTERNAL_CLOSED_PAGES = new Set(["passport", "ticketing"]);

/** True for a page an external tour manager's login never opens, whatever it holds. */
export function isClosedToExternalTourManager(access, page) {
  return isExternalTourManager(access) && EXTERNAL_CLOSED_PAGES.has(page);
}

function staffWidePageAllowed(access, page) {
  if (!access?.allowed) {
    return false;
  }
  return !isExternalTourManager(access) || EXTERNAL_STAFF_WIDE_PAGES.has(page);
}

function navItemAllowed(access, item, eventPhotoBooth) {
  if (item.page === "activity" || STAFF_WIDE_PAGES.has(item.page)) {
    return staffWidePageAllowed(access, item.page);
  }
  if (isClosedToExternalTourManager(access, item.page)) {
    return false;
  }
  if (item.page === "event-photo-booth") {
    return Boolean(access?.allowed && eventPhotoBooth?.canManage);
  }
  if (item.page === "inbound-leads") {
    return canAccessInboundLeads(access);
  }
  if (item.page === "pipeline") {
    return canAccessPipeline(access);
  }
  return hasPermission(access, item.permission);
}

/** @param {import("../eventPhotoBooth/contracts").BoothAccess | undefined} [eventPhotoBooth] */
export function getAccessibleNavGroups(access, eventPhotoBooth) {
  return PORTAL_NAV_GROUPS.flatMap((group) => {
    const items = group.items.filter((item) => navItemAllowed(access, item, eventPhotoBooth));
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

/** @param {import("../eventPhotoBooth/contracts").BoothAccess | undefined} [eventPhotoBooth] */
export function canAccessPage(access, page, eventPhotoBooth) {
  if (page === "activity" || STAFF_WIDE_PAGES.has(page)) {
    return staffWidePageAllowed(access, page);
  }
  if (isClosedToExternalTourManager(access, page)) {
    return false;
  }
  if (page === "event-photo-booth") {
    return Boolean(access?.allowed && eventPhotoBooth?.canManage);
  }
  if (page === "inbound-leads") {
    return canAccessInboundLeads(access);
  }
  if (page === "pipeline") {
    return canAccessPipeline(access);
  }
  return PORTAL_NAV_GROUPS.some((group) =>
    group.items.some((item) => item.page === page && hasPermission(access, item.permission))
  );
}

/** Where `/portal` should land: the dashboard, or the first page a login without it can open. */
export function portalHomeHref(access) {
  if (hasPermission(access, PORTAL_PERMISSIONS.VIEW_DASHBOARD)) {
    return "/portal";
  }
  const first = getAccessibleNavGroups(access)
    .flatMap((group) => group.items)
    .find((item) => item.page !== "activity");
  return first?.href ?? "/portal/activity";
}

function hasRole(access, role) {
  return Boolean(access?.roles?.includes(role));
}

function isAdmin(access) {
  return hasRole(access, "Admin");
}

export function isDirectorOrAdmin(access) {
  return isAdmin(access) || hasRole(access, "Directors") || hasRole(access, "Director Cement");
}

export function canUseTeamPicker(access) {
  return TEAM_PICKER_PERMISSIONS.some((permission) => hasPermission(access, permission));
}

export function canAssignContracting(access) {
  return (
    isDirectorOrAdmin(access) ||
    hasRole(access, "Contracting Head") ||
    hasRole(access, "Operations Head")
  );
}

export function canAssignQueryTicketing(access) {
  return isDirectorOrAdmin(access) || hasRole(access, "Head of Ticketing");
}

export function canHeadAssignQueryTeams(access) {
  return canAssignContracting(access) || canAssignQueryTicketing(access);
}

export function isSalesQueryAssigner(access) {
  return (
    (hasRole(access, "Sales") ||
      hasRole(access, "Sales Head") ||
      hasRole(access, "Sales Cement")) &&
    hasPermission(access, PORTAL_PERMISSIONS.MANAGE_QUERIES)
  );
}

export function usesSalesInitialAssignmentForm(access) {
  return isSalesQueryAssigner(access) && !canHeadAssignQueryTeams(access);
}

function queryHasTeamAssignment(query) {
  return Boolean(
    query?.contractingOwnerId ||
      query?.ticketingOwnerId ||
      query?.ticketingScope ||
      query?.submittedToContractingAt
  );
}

function canShowSalesInitialAssignButton(access, query) {
  return usesSalesInitialAssignmentForm(access) && !queryHasTeamAssignment(query);
}

function canShowHeadAssignQueryButton(access, query) {
  if (!canHeadAssignQueryTeams(access)) {
    return false;
  }
  return Boolean(
    query?.submittedToContractingAt ||
      query?.contractingOwnerId ||
      query?.ticketingOwnerId ||
      query?.ticketingScope
  );
}

export function canShowAssignQueryTeamsButton(access, query) {
  return (
    canShowSalesInitialAssignButton(access, query) || canShowHeadAssignQueryButton(access, query)
  );
}

export function assignQueryTeamsButtonLabel(access) {
  if (usesSalesInitialAssignmentForm(access)) {
    return "Assign contracting";
  }
  return "Assign teams";
}

export function canAssignOperations(access) {
  return isDirectorOrAdmin(access) || hasRole(access, "Operations Head");
}

export function canAssignTicketing(access) {
  return isDirectorOrAdmin(access) || hasRole(access, "Head of Ticketing");
}

export function canAssignTourManagers(access) {
  return isDirectorOrAdmin(access) || hasRole(access, "Operations Head");
}

export function canManageJobCardCreatorAccess(access) {
  return isDirectorOrAdmin(access) || hasRole(access, "Accounts Head");
}

export function canCreateJobCardFromAccounts(access, _creators = []) {
  if (canManageJobCardCreatorAccess(access)) {
    return true;
  }
  return hasRole(access, "Accounts");
}

function filterTeamByRoles(team = [], roles = []) {
  const roleSet = new Set(roles);
  return team.filter((member) => member.roles?.some((role) => roleSet.has(role)));
}

export function teamSelectOptions(team = [], roles = []) {
  return filterTeamByRoles(team, roles).map((member) => ({
    label: member.name,
    member,
    value: member.id,
  }));
}

export function isCementScopedUser(access) {
  if (!access?.roles?.length) {
    return false;
  }
  if (isDirectorOrAdmin(access)) {
    return false;
  }
  return access.roles.some((role) => CEMENT_ROLES.includes(role));
}

export function getQueryTypeOptions(access) {
  return isCementScopedUser(access) ? CEMENT_QUERY_TYPES : QUERY_TYPES;
}
