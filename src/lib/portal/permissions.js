import { PORTAL_NAV_GROUPS, ROLE_PERMISSIONS } from "./constants";

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function getPermissionsForRoles(roles = []) {
  const permissions = new Set();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] || []) {
      permissions.add(permission);
    }
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
