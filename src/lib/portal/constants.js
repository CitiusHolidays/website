export const PORTAL_ROLES = [
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
];

export const PORTAL_PERMISSIONS = {
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

const P = PORTAL_PERMISSIONS;

const DIRECTOR_EXCLUDED_PERMISSIONS = new Set([
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
];

export const CONTRACTING_TEAM_ROLES = ["Contracting", "Contracting Head", "Contracting Cement"];

export const TICKETING_TEAM_ROLES = ["Ticketing", "Head of Ticketing"];

export const SALES_REP_ROLES = ["Sales", "Sales Head", "Sales Cement"];

export const ROLE_PERMISSIONS = {
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
  Admin: Object.values(PORTAL_PERMISSIONS),
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
  Directors: Object.values(PORTAL_PERMISSIONS),
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

export const TICKET_TYPES = ["FIT Ticket", "Group Ticket"];
export const CABIN_CLASSES = ["Economy", "Premium Economy", "Business"];

export const PROPOSAL_STATUSES = ["Draft", "Sent", "Accepted", "Rejected"];

export const JOB_CARD_STATUSES = [
  "Open",
  "In Operations",
  "Ready for Departure",
  "On Tour",
  "Closed",
];
export const INVOICE_STATUSES = ["Draft", "Generated", "Part Paid", "Paid", "Overdue"];
export const SEAT_STATUSES = ["Available", "Held", "Assigned", "Blocked"];
export const TOUR_MANAGER_STATUSES = ["Available", "Assigned", "Inactive"];
export const APPROVAL_STATUSES = ["Pending", "Approved", "Rejected", "Needs Info"];
export const EXPENSE_APPROVAL_STATUSES = ["Pending", "Approved", "Rejected", "Needs Info"];
export const LEAVE_STATUSES = ["Pending", "Approved", "Rejected"];
export const REIMBURSEMENT_STATUSES = ["Not Submitted", "Pending", "Reimbursed"];
export const PORTAL_NAV_GROUPS = [
  {
    items: [
      { href: "/portal", label: "Dashboard", page: "dashboard", permission: P.VIEW_DASHBOARD },
    ],
    label: "Overview",
  },
  {
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
    label: "Enquiries",
  },
  {
    items: [
      {
        href: "/portal/proposals",
        label: "Proposals",
        page: "proposals",
        permission: P.VIEW_PROPOSALS,
        shortcutKey: "proposals",
      },
    ],
    label: "Proposals",
  },
  {
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
    label: "Job Cards",
  },
  {
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
    label: "Ticketing",
  },
  {
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
    label: "Operations",
  },
  {
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
    label: "Finance",
  },
  {
    items: [
      { href: "/portal/team", label: "Team Directory", page: "team", permission: P.VIEW_TEAM },
      {
        href: "/portal/employees-on-leave",
        label: "Employees on Leave",
        page: "employees-on-leave",
        permission: P.VIEW_LEAVE,
      },
    ],
    label: "Admin",
  },
  {
    items: [
      {
        href: "/portal/activity",
        label: "Activity Log",
        page: "activity",
        permission: P.VIEW_ACTIVITY,
      },
      { href: "/portal/settings", label: "Settings", page: "settings", permission: P.MANAGE_STAFF },
    ],
    label: "System",
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

export const CEMENT_ROLES = [
  "Contracting Cement",
  "Operations Cement",
  "Sales Cement",
  "Director Cement",
];

export const CEMENT_QUERY_TYPES = ["Cement", "Cement Bidding"];

export const TRAVEL_TYPES = ["Domestic Travel", "International Travel"];

export const TICKETING_SCOPE_OPTIONS = ["Domestic", "International", "Both", "Not required"];

export const SALES_STATUSES = [
  "Proposal in discussion",
  "Change in destination",
  "Date/Destination Change Required",
  "Order Confirmed",
  "Order Lost",
];

export const SALES_DECISION_OPTIONS = [
  { label: "Proposal Under Discussion", value: "Proposal in discussion" },
  { label: "Date/Destination Change Required", value: "Date/Destination Change Required" },
  { label: "Order Confirmed", value: "Order Confirmed" },
  { label: "Order Lost", value: "Order Lost" },
];

export const LEAD_STAGES = ["Inquiry", "Proposal", "Negotiation", "Confirmation", "Lost"];

export const QUERY_SOURCES = ["Website", "WhatsApp", "Email", "Client", "Referral"];

export const CONTRACTING_STATUSES = [
  "Query Received",
  "Proposal in progress",
  "Proposal sent",
  "Change in destination",
  "Date/Destination Change Required",
  "Order Confirmed",
];

export const CONTRACTING_STATUS_SELECT_OPTIONS = CONTRACTING_STATUSES.filter(
  (status) => !["Order Confirmed", "Order Lost"].includes(status)
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
export const ROOM_TYPES = ["Single", "Twin", "Double", "Triple", "Child with Bed", "Family Room"];
export const FOOD_PREFERENCES = ["Veg", "Non-Veg", "Jain", "Vegan"];
export const GENDER_OPTIONS = ["Male", "Female"];
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
export const LEAVE_TYPES = [
  "Privilege",
  "Casual",
  "Sick",
  "Maternity",
  "Paternity",
  "Bereavement",
  "Marriage",
  "Leave Without Pay",
];

export const EXPENSE_CATEGORIES = EXPENSE_HEADS;

export const PAYMENT_TERMS_BY_QUERY_TYPE = {
  B2B: { maxAdvancePercent: 100, minAdvancePercent: 80 },
  Cement: { maxAdvancePercent: 90, minAdvancePercent: 70 },
  "Cement Bidding": { maxAdvancePercent: 100, minAdvancePercent: 70 },
  "Family Group": { maxAdvancePercent: 100, minAdvancePercent: 90 },
  FIT: { maxAdvancePercent: 100, minAdvancePercent: 90 },
  MICE: { maxAdvancePercent: 90, minAdvancePercent: 70 },
  "MICE Bidding": { maxAdvancePercent: 90, minAdvancePercent: 70 },
  Spiritual: { maxAdvancePercent: 100, minAdvancePercent: 100 },
};

export const PIPELINE_STAGES = [
  "Query Received",
  "Proposal in progress",
  "Proposal sent",
  "Change in destination",
  "Date/Destination Change Required",
  "Order Confirmed",
  "Order Lost",
];

export const SALES_PIPELINE_STAGES = ["Inquiry", "Proposal", "Negotiation", "Confirmation", "Lost"];
