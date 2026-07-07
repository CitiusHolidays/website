import {
  APPROVAL_STATUSES,
  CONTRACTING_STATUSES,
  EXPENSE_APPROVAL_STATUSES,
  EXPENSE_CATEGORIES,
  INVOICE_STATUSES,
  JOB_CARD_STATUSES,
  LEAD_STAGES,
  LEAVE_STATUSES,
  LEAVE_TYPES,
  PROPOSAL_STATUSES,
  QUERY_TYPES,
  REIMBURSEMENT_STATUSES,
  ROOM_TYPES,
  SALES_STATUSES,
  SEAT_STATUSES,
  TICKET_STATUSES,
  TICKET_TYPES,
  TOUR_MANAGER_STATUSES,
  VISA_STATUSES,
} from "@/lib/portal/constants";
import { buildFilterOptions } from "@/lib/portal/listFilters";
import {
  filterByPassportExpiryUrgency,
  PASSPORT_EXPIRY_URGENCY_OPTIONS,
} from "@/lib/portal/passportExpiry";

function staticOptions(values, allLabel) {
  return [{ label: allLabel, value: "" }, ...values.map((v) => ({ label: v, value: v }))];
}

function fromRows(field, allLabel) {
  return {
    field,
    label: allLabel.replace(/^All /, ""),
    options: "fromRows",
    resolveOptions(rows) {
      return [
        { label: allLabel, value: "" },
        ...buildFilterOptions(rows, field).map((v) => ({ label: v, value: v })),
      ];
    },
  };
}

/** Portal workspace views that render list tables or filterable grids. */
export const PORTAL_LIST_VIEWS = [
  "dashboard",
  "queries",
  "pipeline",
  "proposals",
  "contracting",
  "accounts-job-cards",
  "job-cards",
  "travellers",
  "passport",
  "visa",
  "hotels",
  "tour-managers",
  "ticketing",
  "flights",
  "tickets",
  "seat-allocation",
  "finance",
  "expenses",
  "approvals",
  "employees-on-leave",
  "team",
  "activity",
  "reports",
  "settings",
];

function staticOptionValues(options) {
  if (!Array.isArray(options)) {
    return [];
  }
  const values = [];
  for (const entry of options) {
    if (entry.value) {
      values.push(entry.value);
    }
  }
  return values;
}

/** @type {Record<string, import('./listFilters.js').ListFilterDef[]>} */
export const LIST_FILTER_CONFIG = {
  "accounts-job-cards": [
    {
      field: "queryType",
      label: "Query type",
      options: staticOptions(QUERY_TYPES, "All query types"),
    },
  ],
  activity: [fromRows("entityType", "All entity types")],
  approvals: [
    { field: "status", label: "Status", options: staticOptions(APPROVAL_STATUSES, "All statuses") },
    { field: "type", label: "Type", options: staticOptions(["Expense", "Finance"], "All types") },
  ],
  contracting: [
    {
      field: "contractingStatus",
      label: "Contracting status",
      options: staticOptions(CONTRACTING_STATUSES, "All contracting statuses"),
    },
    {
      field: "queryType",
      label: "Query type",
      options: staticOptions(QUERY_TYPES, "All query types"),
    },
  ],
  dashboard: [],
  "employees-on-leave": [
    { field: "status", label: "Status", options: staticOptions(LEAVE_STATUSES, "All statuses") },
    {
      field: "leaveType",
      label: "Leave type",
      options: staticOptions(LEAVE_TYPES, "All leave types"),
    },
  ],
  expenses: [
    {
      field: "approvalStatus",
      label: "Approval status",
      options: staticOptions(EXPENSE_APPROVAL_STATUSES, "All approval statuses"),
    },
    {
      field: "reimbursementStatus",
      label: "Reimbursement",
      options: staticOptions(REIMBURSEMENT_STATUSES, "All reimbursement statuses"),
    },
    {
      field: "category",
      label: "Category",
      options: staticOptions(EXPENSE_CATEGORIES, "All categories"),
    },
  ],
  finance: [
    {
      field: "status",
      label: "Invoice status",
      options: staticOptions(INVOICE_STATUSES, "All statuses"),
    },
  ],
  flights: [fromRows("status", "All PNR statuses")],
  hotels: [
    { field: "roomType", label: "Room type", options: staticOptions(ROOM_TYPES, "All room types") },
  ],
  "job-cards": [
    { field: "status", label: "Status", options: staticOptions(JOB_CARD_STATUSES, "All statuses") },
    {
      field: "queryType",
      label: "Query type",
      options: staticOptions(QUERY_TYPES, "All query types"),
    },
  ],
  passport: [
    {
      field: "passportStatus",
      label: "Passport status",
      options: staticOptions(["Pending", "Received"], "All passport statuses"),
    },
  ],
  pipeline: [
    {
      field: "salesStatus",
      label: "Sales status",
      options: staticOptions(SALES_STATUSES, "All sales statuses"),
    },
    {
      field: "contractingStatus",
      label: "Contracting status",
      options: staticOptions(CONTRACTING_STATUSES, "All contracting statuses"),
    },
    {
      field: "queryType",
      label: "Query type",
      options: staticOptions(QUERY_TYPES, "All query types"),
    },
    {
      field: "leadStage",
      label: "Lead stage",
      options: staticOptions(LEAD_STAGES, "All lead stages"),
    },
  ],
  proposals: [
    { field: "status", label: "Status", options: staticOptions(PROPOSAL_STATUSES, "All statuses") },
  ],
  queries: [
    {
      field: "salesStatus",
      label: "Sales status",
      options: staticOptions(SALES_STATUSES, "All sales statuses"),
    },
    {
      field: "contractingStatus",
      label: "Contracting status",
      options: staticOptions(CONTRACTING_STATUSES, "All contracting statuses"),
    },
    {
      field: "queryType",
      label: "Query type",
      options: staticOptions(QUERY_TYPES, "All query types"),
    },
  ],
  reports: [],
  "seat-allocation": [
    { field: "status", label: "Status", options: staticOptions(SEAT_STATUSES, "All statuses") },
  ],
  settings: [],
  team: [fromRows("department", "All departments"), fromRows("function", "All functions")],
  ticketing: [
    {
      field: "ticketStatus",
      label: "Ticket status",
      options: staticOptions(TICKET_STATUSES, "All ticket statuses"),
    },
  ],
  tickets: [
    {
      field: "ticketStatus",
      label: "Ticket status",
      options: staticOptions(TICKET_STATUSES, "All ticket statuses"),
    },
    {
      field: "ticketType",
      label: "Ticket type",
      options: staticOptions(TICKET_TYPES, "All ticket types"),
    },
  ],
  "tour-managers": [
    {
      field: "status",
      label: "Status",
      options: staticOptions(TOUR_MANAGER_STATUSES, "All statuses"),
    },
    {
      field: "callingStatus",
      label: "Calling status",
      options: staticOptions(["Pending", "Done", "No response"], "All calling statuses"),
    },
  ],
  travellers: [
    {
      field: "visaStatus",
      label: "Visa status",
      options: staticOptions(VISA_STATUSES, "All visa statuses"),
    },
    {
      field: "ticketStatus",
      label: "Ticket status",
      options: staticOptions(TICKET_STATUSES, "All ticket statuses"),
    },
    {
      field: "callingStatus",
      label: "Calling status",
      options: staticOptions(["Pending", "Done", "No response"], "All calling statuses"),
    },
    {
      field: "passportExpiryUrgency",
      filterFn: filterByPassportExpiryUrgency,
      label: "Passport expiry",
      options: PASSPORT_EXPIRY_URGENCY_OPTIONS,
    },
  ],
  visa: [
    { field: "status", label: "Status", options: staticOptions(VISA_STATUSES, "All statuses") },
  ],
};

export { VIEWS_WITH_JOB_CARD_FILTER } from "@/lib/portal/jobCardFilterViews.js";

export { staticOptionValues };

/** Search keys used when computing filter option counts per view. */
export const VIEW_FILTER_SEARCH_KEYS = {
  "accounts-job-cards": ["queryCode", "clientName", "destination", "queryType"],
  activity: ["action", "summary", "entityType", "actorName"],
  approvals: ["requestCode", "summary", "requestedByName", "type"],
  contracting: ["queryCode", "clientName", "destination", "queryType"],
  "employees-on-leave": ["staffName", "staffEmail", "department", "reason", "leaveType", "status"],
  expenses: ["particulars", "paidBy", "tourManagerName", "jobCode"],
  finance: ["invoiceNumber", "jobCode"],
  flights: ["pnrCode", "jobCode", "status"],
  hotels: [
    "fullName",
    "jobCode",
    "travelHub",
    "hotelAllocation",
    "roomType",
    "travelBatchReference",
  ],
  "job-cards": ["jobCode", "clientName", "destination", "queryType"],
  passport: ["fullName", "jobCode", "passportStatus", "travelBatchReference"],
  pipeline: ["queryCode", "clientName", "destination", "queryType", "salesOwnerName"],
  proposals: ["proposalCode", "queryCode", "clientName", "destination"],
  queries: ["queryCode", "clientName", "destination", "queryType", "salesOwnerName"],
  "seat-allocation": ["seatNumber", "jobCode"],
  team: ["name", "email", "department", "function", "location", "mobile", "roles"],
  ticketing: ["ticketNumber", "travellerName", "jobCode", "pnrCode"],
  tickets: ["ticketNumber", "travellerName", "jobCode", "pnrCode"],
  "tour-managers": ["name", "email", "phone", "jobCode"],
  travellers: [
    "fullName",
    "jobCode",
    "travelHub",
    "visaStatus",
    "ticketStatus",
    "travelBatchReference",
  ],
  visa: ["travellerName", "jobCode", "status", "destination"],
};

export function getViewFilterSearchKeys(view) {
  return VIEW_FILTER_SEARCH_KEYS[view] ?? VIEW_FILTER_SEARCH_KEYS.queries;
}

export function getListFilterConfig(view, { pipelineMode = "sales" } = {}) {
  if (view === "pipeline") {
    if (pipelineMode === "sales") {
      return [
        {
          field: "leadStage",
          label: "Lead stage",
          options: staticOptions(LEAD_STAGES, "All lead stages"),
        },
        {
          field: "queryType",
          label: "Query type",
          options: staticOptions(QUERY_TYPES, "All query types"),
        },
      ];
    }
    return (LIST_FILTER_CONFIG.pipeline ?? []).filter((def) => def.field !== "leadStage");
  }
  return LIST_FILTER_CONFIG[view] ?? [];
}
