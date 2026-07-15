export const PERMISSIONS = {
  APPROVE_EXPENSES: "approve:expenses",
  APPROVE_LEAVE: "approve:leave",
  CREATE_EXPENSES: "create:expenses",
  MANAGE_ALL_EXPENSES: "manageAll:expenses",
  MANAGE_CONTRACTING: "manage:contracting",
  MANAGE_DROPDOWNS: "manage:dropdowns",
  MANAGE_EXPENSES: "manage:expenses",
  MANAGE_FINANCE: "manage:finance",
  MANAGE_JOB_CARDS: "manage:jobCards",
  MANAGE_LEAVE: "manage:leave",
  MANAGE_OPERATIONS: "manage:operations",
  MANAGE_PROPOSALS: "manage:proposals",
  MANAGE_QUERIES: "manage:queries",
  MANAGE_STAFF: "manage:staff",
  MANAGE_TICKETING: "manage:ticketing",
  MANAGE_TOUR_MANAGERS: "manage:tourManagers",
  MANAGE_TRAVELLERS: "manage:travellers",
  MANAGE_VISA: "manage:visa",
  REQUEST_LEAVE: "request:leave",
  SEND_PROPOSALS: "send:proposals",
  VIEW_ACTIVITY: "view:activity",
  VIEW_APPROVALS: "view:approvals",
  VIEW_CONTRACTING: "view:contracting",
  VIEW_DASHBOARD: "view:dashboard",
  VIEW_EXPENSES: "view:expenses",
  VIEW_FINANCE: "view:finance",
  VIEW_JOB_CARDS: "view:jobCards",
  VIEW_LEAVE: "view:leave",
  VIEW_OPERATIONS: "view:operations",
  VIEW_PROPOSALS: "view:proposals",
  VIEW_QUERIES: "view:queries",
  VIEW_REPORTS: "view:reports",
  VIEW_SENSITIVE_TRAVELLER_DATA: "view:sensitiveTravellerData",
  VIEW_TEAM: "view:team",
  VIEW_TICKETING: "view:ticketing",
  VIEW_TOUR_MANAGERS: "view:tourManagers",
  VIEW_TRAVELLERS: "view:travellers",
  VIEW_VISA: "view:visa",
};

export const ALL_ROLES = [
  "Admin",
  "Directors",
  "Sales",
  "Sales Head",
  "Contracting",
  "Contracting Head",
  "Accounts",
  "Accounts Head",
  "Operations",
  "Operations Head",
  "Ticketing",
  "Head of Ticketing",
  "Tour Manager",
  "Finance",
  "HR",
  "Contracting Cement",
  "Operations Cement",
  "Sales Cement",
  "Director Cement",
] as const;

const P = PERMISSIONS;

const DIRECTOR_EXCLUDED_PERMISSIONS = new Set<string>([
  P.MANAGE_STAFF,
  P.MANAGE_DROPDOWNS,
  P.VIEW_ACTIVITY,
]);

export const DIRECTOR_PERMISSIONS = Object.values(P).filter(
  (permission) => !DIRECTOR_EXCLUDED_PERMISSIONS.has(permission)
);

export const TEAM_PICKER_PERMISSIONS = [
  P.VIEW_TEAM,
  P.MANAGE_QUERIES,
  P.MANAGE_CONTRACTING,
  P.MANAGE_PROPOSALS,
  P.MANAGE_JOB_CARDS,
  P.MANAGE_OPERATIONS,
  P.MANAGE_TICKETING,
  P.MANAGE_LEAVE,
] as const;

export const CONTRACTING_TEAM_ROLES = [
  "Contracting",
  "Contracting Head",
  "Contracting Cement",
] as const;

export const TICKETING_TEAM_ROLES = ["Ticketing", "Head of Ticketing"] as const;

export const SALES_REP_ROLES = ["Sales", "Sales Head", "Sales Cement"] as const;

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  Accounts: [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.MANAGE_JOB_CARDS,
    P.VIEW_FINANCE,
    P.MANAGE_FINANCE,
    P.VIEW_EXPENSES,
    P.VIEW_LEAVE,
    P.VIEW_REPORTS,
  ],
  "Accounts Head": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_JOB_CARDS,
    P.MANAGE_JOB_CARDS,
    P.VIEW_FINANCE,
    P.MANAGE_FINANCE,
    P.VIEW_EXPENSES,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.VIEW_REPORTS,
  ],
  Admin: Object.values(P),
  Contracting: [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_CONTRACTING,
    P.MANAGE_CONTRACTING,
    P.VIEW_PROPOSALS,
    P.MANAGE_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.VIEW_LEAVE,
  ],
  "Contracting Cement": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_CONTRACTING,
    P.MANAGE_CONTRACTING,
    P.VIEW_PROPOSALS,
    P.MANAGE_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.VIEW_LEAVE,
  ],
  "Contracting Head": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_CONTRACTING,
    P.MANAGE_CONTRACTING,
    P.VIEW_PROPOSALS,
    P.MANAGE_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.APPROVE_LEAVE,
  ],
  "Director Cement": DIRECTOR_PERMISSIONS,
  Directors: Object.values(P),
  Finance: [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_FINANCE,
    P.MANAGE_FINANCE,
    P.MANAGE_ALL_EXPENSES,
    P.VIEW_EXPENSES,
    P.APPROVE_EXPENSES,
    P.VIEW_LEAVE,
    P.VIEW_APPROVALS,
    P.VIEW_REPORTS,
  ],
  "Head of Ticketing": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.VIEW_TICKETING,
    P.MANAGE_TICKETING,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.APPROVE_LEAVE,
  ],
  HR: [
    P.VIEW_DASHBOARD,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.MANAGE_LEAVE,
    P.APPROVE_LEAVE,
    P.VIEW_APPROVALS,
  ],
  Operations: [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.MANAGE_TRAVELLERS,
    P.VIEW_VISA,
    P.MANAGE_VISA,
    P.VIEW_OPERATIONS,
    P.MANAGE_OPERATIONS,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_TICKETING,
    P.VIEW_EXPENSES,
    P.VIEW_LEAVE,
  ],
  "Operations Cement": [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.MANAGE_TRAVELLERS,
    P.VIEW_VISA,
    P.MANAGE_VISA,
    P.VIEW_OPERATIONS,
    P.MANAGE_OPERATIONS,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_TICKETING,
    P.VIEW_EXPENSES,
    P.VIEW_LEAVE,
  ],
  "Operations Head": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_CONTRACTING,
    P.VIEW_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.MANAGE_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.MANAGE_TRAVELLERS,
    P.VIEW_VISA,
    P.MANAGE_VISA,
    P.VIEW_OPERATIONS,
    P.MANAGE_OPERATIONS,
    P.VIEW_TOUR_MANAGERS,
    P.MANAGE_TOUR_MANAGERS,
    P.VIEW_TICKETING,
    P.VIEW_EXPENSES,
    P.VIEW_FINANCE,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.APPROVE_LEAVE,
    P.VIEW_SENSITIVE_TRAVELLER_DATA,
  ],
  Sales: [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.MANAGE_QUERIES,
    P.VIEW_PROPOSALS,
    P.SEND_PROPOSALS,
    P.VIEW_LEAVE,
  ],
  "Sales Cement": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.MANAGE_QUERIES,
    P.VIEW_PROPOSALS,
    P.SEND_PROPOSALS,
    P.VIEW_LEAVE,
  ],
  "Sales Head": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.MANAGE_QUERIES,
    P.VIEW_PROPOSALS,
    P.SEND_PROPOSALS,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.APPROVE_LEAVE,
  ],
  Ticketing: [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_PROPOSALS,
    P.MANAGE_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.VIEW_TICKETING,
    P.MANAGE_TICKETING,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_LEAVE,
  ],
  "Tour Manager": [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.VIEW_VISA,
    P.VIEW_TICKETING,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_EXPENSES,
    P.MANAGE_EXPENSES,
    P.VIEW_LEAVE,
  ],
};

export const PAYMENT_TERMS: Record<string, { min: number; max: number }> = {
  B2B: { max: 100, min: 80 },
  Cement: { max: 90, min: 70 },
  "Cement Bidding": { max: 100, min: 70 },
  "Family Group": { max: 100, min: 90 },
  FIT: { max: 100, min: 90 },
  MICE: { max: 90, min: 70 },
  "MICE Bidding": { max: 90, min: 70 },
  Spiritual: { max: 100, min: 100 },
};

export const CEMENT_ROLES = [
  "Contracting Cement",
  "Operations Cement",
  "Sales Cement",
  "Director Cement",
] as const;

export const CEMENT_QUERY_TYPES = ["Cement", "Cement Bidding"] as const;

export const HEAD_ROLES = [
  "Sales Head",
  "Contracting Head",
  "Operations Head",
  "Head of Ticketing",
  "HR",
] as const;

export function getRolePermissions(roles: string[]) {
  const permissions = new Set<string>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      permissions.add(permission);
    }
  }
  if (roles.length > 0) {
    permissions.add(P.REQUEST_LEAVE);
    permissions.add(P.VIEW_EXPENSES);
    permissions.add(P.CREATE_EXPENSES);
  }
  return Array.from(permissions).sort();
}

export function paymentTermsFor(queryType: string) {
  const terms = PAYMENT_TERMS[queryType] ?? { max: 100, min: 70 };
  return {
    label:
      terms.min === terms.max ? `${terms.min}% advance` : `${terms.min}%-${terms.max}% advance`,
    maxAdvancePercent: terms.max,
    minAdvancePercent: terms.min,
  };
}
