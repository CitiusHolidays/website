export function getCompactRoleLabel(roles: readonly string[]): string {
  const [primaryRole] = roles;
  if (!primaryRole) {
    return "Staff";
  }
  if (roles.length === 1) {
    return primaryRole;
  }
  return `${primaryRole} +${roles.length - 1}`;
}
