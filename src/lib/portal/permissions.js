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

export function hasPermission(access, permission) {
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

function navItemAllowed(access, item) {
  if (item.page === "pipeline") {
    return canAccessPipeline(access);
  }
  return hasPermission(access, item.permission);
}

export function getAccessibleNavGroups(access) {
  return PORTAL_NAV_GROUPS.flatMap((group) => {
    const items = group.items.filter((item) => navItemAllowed(access, item));
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

export function canAccessPage(access, page) {
  if (page === "pipeline") {
    return canAccessPipeline(access);
  }
  return PORTAL_NAV_GROUPS.some((group) =>
    group.items.some((item) => item.page === page && hasPermission(access, item.permission))
  );
}

export function hasRole(access, role) {
  return Boolean(access?.roles?.includes(role));
}

export function isAdmin(access) {
  return hasRole(access, "Admin");
}

export function isDirectorOrAdmin(access) {
  return isAdmin(access) || hasRole(access, "Directors") || hasRole(access, "Director Cement");
}

export function canUseTeamPicker(access) {
  return TEAM_PICKER_PERMISSIONS.some((permission) => hasPermission(access, permission));
}

export function isHead(access, department) {
  const headRole = department.includes("Head") ? department : `${department} Head`;
  if (department === "Ticketing") {
    return hasRole(access, "Head of Ticketing");
  }
  return hasRole(access, headRole);
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

export function queryHasTeamAssignment(query) {
  return Boolean(
    query?.contractingOwnerId ||
      query?.ticketingOwnerId ||
      query?.ticketingScope ||
      query?.submittedToContractingAt
  );
}

export function canShowSalesInitialAssignButton(access, query) {
  return usesSalesInitialAssignmentForm(access) && !queryHasTeamAssignment(query);
}

export function canShowHeadAssignQueryButton(access, query) {
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
