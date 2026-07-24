export function canDeleteQuery(access?: { roles?: string[] } | null) {
  const roles = access?.roles ?? [];
  return roles.includes("Admin") || roles.includes("Directors");
}
