import { PORTAL_NAV_GROUPS, PORTAL_PERMISSIONS, ROLE_PERMISSIONS } from "./constants";

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
  }
  return Array.from(permissions).sort();
}

export function hasPermission(access, permission) {
  if (!permission) {
    return true;
  }
  return Boolean(access?.permissions?.includes(permission));
}

export function getAccessibleNavGroups(access) {
  return PORTAL_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermission(access, item.permission)),
  })).filter((group) => group.items.length > 0);
}

export function canAccessPage(access, page) {
  return PORTAL_NAV_GROUPS.some((group) =>
    group.items.some((item) => item.page === page && hasPermission(access, item.permission)),
  );
}

export function hasRole(access, role) {
  return Boolean(access?.roles?.includes(role));
}

export function isAdmin(access) {
  return hasRole(access, "Admin");
}

export function isHead(access, department) {
  const headRole = department.includes("Head") ? department : `${department} Head`;
  if (department === "Ticketing") {
    return hasRole(access, "Head of Ticketing");
  }
  return hasRole(access, headRole);
}

export function canAssignContracting(access) {
  return isAdmin(access) || hasRole(access, "Contracting Head");
}

export function canAssignOperations(access) {
  return isAdmin(access) || hasRole(access, "Operations Head");
}

export function canAssignTicketing(access) {
  return isAdmin(access) || hasRole(access, "Head of Ticketing");
}

export function canAssignTourManagers(access) {
  return isAdmin(access) || hasRole(access, "Operations Head");
}

export function filterTeamByRoles(team = [], roles = []) {
  return team.filter((member) => member.roles?.some((role) => roles.includes(role)));
}

export function teamSelectOptions(team = [], roles = []) {
  return filterTeamByRoles(team, roles).map((member) => ({
    value: member.id,
    label: member.name,
    member,
  }));
}
