export const PORTAL_ROLES = [
  "Admin",
  "Directors",
  "Sales",
  "Sales Head",
  "Contracting",
  "Contracting Head",
  "Accounts",
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
];

export const PORTAL_PERMISSIONS = {
  VIEW_DASHBOARD: "view:dashboard",
  MANAGE_STAFF: "manage:staff",
  MANAGE_DROPDOWNS: "manage:dropdowns",
  VIEW_QUERIES: "view:queries",
  MANAGE_QUERIES: "manage:queries",
  VIEW_CONTRACTING: "view:contracting",
  MANAGE_CONTRACTING: "manage:contracting",
  VIEW_PROPOSALS: "view:proposals",
  MANAGE_PROPOSALS: "manage:proposals",
  SEND_PROPOSALS: "send:proposals",
  VIEW_JOB_CARDS: "view:jobCards",
  MANAGE_JOB_CARDS: "manage:jobCards",
  VIEW_TRAVELLERS: "view:travellers",
  MANAGE_TRAVELLERS: "manage:travellers",
  VIEW_VISA: "view:visa",
  MANAGE_VISA: "manage:visa",
  VIEW_TICKETING: "view:ticketing",
  MANAGE_TICKETING: "manage:ticketing",
  VIEW_OPERATIONS: "view:operations",
  MANAGE_OPERATIONS: "manage:operations",
  VIEW_TOUR_MANAGERS: "view:tourManagers",
  MANAGE_TOUR_MANAGERS: "manage:tourManagers",
  VIEW_FINANCE: "view:finance",
  MANAGE_FINANCE: "manage:finance",
  VIEW_EXPENSES: "view:expenses",
  MANAGE_EXPENSES: "manage:expenses",
  APPROVE_EXPENSES: "approve:expenses",
  VIEW_TEAM: "view:team",
  VIEW_LEAVE: "view:leave",
  MANAGE_LEAVE: "manage:leave",
  APPROVE_LEAVE: "approve:leave",
  VIEW_APPROVALS: "view:approvals",
  VIEW_REPORTS: "view:reports",
  VIEW_ACTIVITY: "view:activity",
  VIEW_SENSITIVE_TRAVELLER_DATA: "view:sensitiveTravellerData",
  REQUEST_LEAVE: "request:leave",
};

const P = PORTAL_PERMISSIONS;

export const ROLE_PERMISSIONS = {
  Admin: Object.values(PORTAL_PERMISSIONS),
  Directors: [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_CONTRACTING,
    P.VIEW_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.VIEW_VISA,
    P.VIEW_TICKETING,
    P.VIEW_OPERATIONS,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_FINANCE,
    P.VIEW_EXPENSES,
    P.APPROVE_EXPENSES,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.APPROVE_LEAVE,
    P.VIEW_APPROVALS,
    P.VIEW_REPORTS,
    P.VIEW_SENSITIVE_TRAVELLER_DATA,
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
  Sales: [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.MANAGE_QUERIES,
    P.VIEW_PROPOSALS,
    P.SEND_PROPOSALS,
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
  "Head of Ticketing": [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.VIEW_TICKETING,
    P.MANAGE_TICKETING,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.APPROVE_LEAVE,
  ],
  Ticketing: [
    P.VIEW_DASHBOARD,
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
  Finance: [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_FINANCE,
    P.MANAGE_FINANCE,
    P.VIEW_EXPENSES,
    P.APPROVE_EXPENSES,
    P.VIEW_LEAVE,
    P.VIEW_APPROVALS,
    P.VIEW_REPORTS,
  ],
  HR: [
    P.VIEW_DASHBOARD,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.MANAGE_LEAVE,
    P.APPROVE_LEAVE,
    P.VIEW_APPROVALS,
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
  "Sales Cement": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.MANAGE_QUERIES,
    P.VIEW_PROPOSALS,
    P.SEND_PROPOSALS,
    P.VIEW_LEAVE,
  ],
  "Director Cement": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_CONTRACTING,
    P.VIEW_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.VIEW_VISA,
    P.VIEW_TICKETING,
    P.VIEW_OPERATIONS,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_FINANCE,
    P.VIEW_EXPENSES,
    P.APPROVE_EXPENSES,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.APPROVE_LEAVE,
    P.VIEW_APPROVALS,
    P.VIEW_REPORTS,
    P.VIEW_SENSITIVE_TRAVELLER_DATA,
  ],
};

export const PROPOSAL_TAX_RATES = [5, 18];

export const TICKET_TYPES = ["FIT Ticket", "Group Ticket"];
export const CABIN_CLASSES = ["Economy", "Premium Economy", "Business"];

export const PORTAL_NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/portal", label: "Dashboard", page: "dashboard", permission: P.VIEW_DASHBOARD },
    ],
  },
  {
    label: "Enquiries",
    items: [
      {
        href: "/portal/queries",
        label: "All Sales Queries",
        page: "queries",
        permission: P.VIEW_QUERIES,
        shortcutKey: "queries",
      },
      {
        href: "/portal/pipeline",
        label: "Pipeline View",
        page: "pipeline",
        permission: P.VIEW_QUERIES,
      },
      {
        href: "/portal/contracting",
        label: "Contracting",
        page: "contracting",
        permission: P.VIEW_CONTRACTING,
      },
    ],
  },
  {
    label: "Proposals",
    items: [
      {
        href: "/portal/proposals",
        label: "Proposals",
        page: "proposals",
        permission: P.VIEW_PROPOSALS,
        shortcutKey: "proposals",
      },
    ],
  },
  {
    label: "Job Cards",
    items: [
      {
        href: "/portal/accounts/job-cards",
        label: "Accounts / JC",
        page: "accounts-job-cards",
        permission: P.MANAGE_JOB_CARDS,
      },
      {
        href: "/portal/job-cards",
        label: "Job Cards",
        page: "job-cards",
        permission: P.VIEW_JOB_CARDS,
        shortcutKey: "jobCards",
      },
    ],
  },
  {
    label: "Ticketing",
    items: [
      {
        href: "/portal/ticketing",
        label: "Ticket Dashboard",
        page: "ticketing",
        permission: P.VIEW_TICKETING,
      },
      {
        href: "/portal/flights",
        label: "Flights & PNR",
        page: "flights",
        permission: P.VIEW_TICKETING,
      },
      {
        href: "/portal/seat-allocation",
        label: "Seat Allocation",
        page: "seat-allocation",
        permission: P.VIEW_TICKETING,
      },
      {
        href: "/portal/tickets",
        label: "All Tickets",
        page: "tickets",
        permission: P.VIEW_TICKETING,
        shortcutKey: "tickets",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/portal/travellers",
        label: "Traveller Master",
        page: "travellers",
        permission: P.VIEW_TRAVELLERS,
      },
      {
        href: "/portal/passport",
        label: "Passport Documents",
        page: "passport",
        permission: P.VIEW_VISA,
      },
      { href: "/portal/visa", label: "Visa Tracking", page: "visa", permission: P.VIEW_VISA },
      {
        href: "/portal/hotels",
        label: "Hotel / Rooming",
        page: "hotels",
        permission: P.VIEW_OPERATIONS,
      },
      {
        href: "/portal/tour-managers",
        label: "Tour Managers",
        page: "tour-managers",
        permission: P.VIEW_TOUR_MANAGERS,
      },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/portal/finance", label: "Finance", page: "finance", permission: P.VIEW_FINANCE },
      {
        href: "/portal/expenses",
        label: "Expenses",
        page: "expenses",
        permission: P.VIEW_EXPENSES,
      },
      {
        href: "/portal/approvals",
        label: "Approvals",
        page: "approvals",
        permission: P.VIEW_APPROVALS,
      },
      { href: "/portal/reports", label: "Reports", page: "reports", permission: P.VIEW_REPORTS },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/portal/team", label: "Team Directory", page: "team", permission: P.VIEW_TEAM },
      {
        href: "/portal/employees-on-leave",
        label: "Employees on Leave",
        page: "employees-on-leave",
        permission: P.VIEW_LEAVE,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        href: "/portal/activity",
        label: "Activity Log",
        page: "activity",
        permission: P.VIEW_ACTIVITY,
      },
      { href: "/portal/settings", label: "Settings", page: "settings", permission: P.MANAGE_STAFF },
    ],
  },
];

export const QUERY_TYPES = [
  "MICE",
  "MICE Bidding",
  "Cement",
  "Cement Bidding",
  "FIT",
  "Family Group",
  "B2B",
  "Spiritual",
];

export const TRAVEL_TYPES = ["Domestic Travel", "International Travel"];

export const SALES_STATUSES = [
  "Proposal in discussion",
  "Change in destination",
  "Order Confirmed",
  "Order Lost",
];

export const LEAD_STAGES = ["Inquiry", "Proposal", "Negotiation", "Confirmation", "Lost"];

export const QUERY_SOURCES = ["Website", "WhatsApp", "Email", "Client", "Referral"];

export const CONTRACTING_STATUSES = [
  "Query Received",
  "Proposal in progress",
  "Proposal sent",
  "Change in destination",
  "Order Confirmed",
];

export const CONTRACTING_STATUS_SELECT_OPTIONS = CONTRACTING_STATUSES.filter(
  (status) => !["Order Confirmed", "Order Lost"].includes(status),
);

export const LOST_REASONS = ["Price", "Competition", "Not travelling", "Other"];

export const VISA_STATUSES = [
  "Not Required",
  "Not Started",
  "Checklist Shared",
  "Documents Pending",
  "Documents Verified",
  "Appointment Scheduled",
  "Submitted",
  "Awaiting",
  "Approved",
  "Rejected",
  "Re-applied",
];

export const TICKET_STATUSES = [
  "Pending Issue",
  "Issued",
  "Name Change Required",
  "Reissue Required",
  "Cancelled",
  "Refund Pending",
  "Refunded",
];

export const PAYMENT_TYPES = ["Company Paid", "Self Paid", "Upgraded Self Paid"];
export const ROOM_TYPES = ["SGL", "Twin", "DBL", "Child with Bed", "Family Room"];
export const FOOD_PREFERENCES = ["Veg", "Non-Veg", "Jain", "Vegan"];
export const CALLING_STATUSES = ["Pending", "Done", "No response"];
export const GUEST_TYPES = ["Employee", "Client", "VIP"];
export const EXPENSE_HEADS = [
  "F&B",
  "Transport",
  "Hotel",
  "Activity",
  "Visa",
  "Tips",
  "Miscellaneous",
];
export const EXPENSE_CURRENCIES = ["INR", "USD", "AED", "EUR", "THB", "SGD"];
export const LEAVE_TYPES = ["Casual", "Sick", "Privilege", "Leave Without Pay"];

export const PAYMENT_TERMS_BY_QUERY_TYPE = {
  MICE: { minAdvancePercent: 70, maxAdvancePercent: 90 },
  "MICE Bidding": { minAdvancePercent: 70, maxAdvancePercent: 90 },
  Cement: { minAdvancePercent: 70, maxAdvancePercent: 90 },
  "Cement Bidding": { minAdvancePercent: 70, maxAdvancePercent: 100 },
  FIT: { minAdvancePercent: 90, maxAdvancePercent: 100 },
  "Family Group": { minAdvancePercent: 90, maxAdvancePercent: 100 },
  B2B: { minAdvancePercent: 80, maxAdvancePercent: 100 },
  Spiritual: { minAdvancePercent: 100, maxAdvancePercent: 100 },
};

export const PIPELINE_STAGES = [
  "Query Received",
  "Proposal in progress",
  "Proposal sent",
  "Change in destination",
  "Order Confirmed",
  "Order Lost",
];

export const SALES_PIPELINE_STAGES = ["Inquiry", "Proposal", "Negotiation", "Confirmation", "Lost"];
