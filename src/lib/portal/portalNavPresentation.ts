export interface PortalNavigationItem {
  href: string;
  label: string;
}

export interface PortalNavigationGroup {
  items: PortalNavigationItem[];
}

const MOBILE_QUICK_NAV_PRIORITY = [
  "/portal",
  "/portal/queries",
  "/portal/proposals",
  "/portal/accounts/job-cards",
  "/portal/job-cards",
  "/portal/ticketing",
  "/portal/travellers",
  "/portal/finance",
  "/portal/approvals",
  "/portal/expenses",
] as const;

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

export function getMobileQuickNavigation(
  groups: readonly PortalNavigationGroup[],
  limit = 4
): PortalNavigationItem[] {
  const priority = new Map<string, number>(
    MOBILE_QUICK_NAV_PRIORITY.map((href, index) => [href, index])
  );
  const items = groups.flatMap((group) => group.items);

  return [...items]
    .sort((first, second) => {
      const firstPriority = priority.get(first.href) ?? Number.POSITIVE_INFINITY;
      const secondPriority = priority.get(second.href) ?? Number.POSITIVE_INFINITY;
      return firstPriority - secondPriority;
    })
    .slice(0, limit);
}
