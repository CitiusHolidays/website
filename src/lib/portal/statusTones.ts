import {
  APPROVAL_STATUSES,
  CALLING_STATUSES,
  CONTRACTING_STATUSES,
  EXPENSE_APPROVAL_STATUSES,
  INVOICE_STATUSES,
  JOB_CARD_STATUSES,
  LEAD_STAGES,
  LEAVE_STATUSES,
  PROPOSAL_STATUSES,
  SALES_STATUSES,
  SEAT_STATUSES,
  TOUR_MANAGER_STATUSES,
  VISA_STATUSES,
} from "./constants.js";
import { CANONICAL_TICKET_STATUSES } from "./ticketListPresentation";

export type StatusDomain =
  | "approval"
  | "calling"
  | "dashboardReadiness"
  | "expense"
  | "invoice"
  | "jobCard"
  | "leave"
  | "leaveReview"
  | "proposal"
  | "queryContracting"
  | "queryLeadStage"
  | "querySales"
  | "seat"
  | "ticketing"
  | "tourManager"
  | "visa";

export type SemanticTone = "danger" | "info" | "neutral" | "positive" | "progress" | "warning";

export type BadgeTone = "amber" | "blue" | "gray" | "green" | "purple" | "red";

export interface StatusPresentation {
  badgeTone: BadgeTone;
  meaning: string;
  semanticTone: SemanticTone;
}

export const DASHBOARD_READINESS_STATUSES = ["Ready", "Docs pending", "Ticketing"] as const;

export const CANONICAL_STATUSES_BY_DOMAIN = {
  approval: APPROVAL_STATUSES,
  calling: CALLING_STATUSES,
  dashboardReadiness: DASHBOARD_READINESS_STATUSES,
  expense: EXPENSE_APPROVAL_STATUSES,
  invoice: INVOICE_STATUSES,
  jobCard: JOB_CARD_STATUSES,
  leave: LEAVE_STATUSES,
  leaveReview: LEAVE_STATUSES,
  proposal: [...PROPOSAL_STATUSES, "With Sales", "Sent to Client"],
  queryContracting: CONTRACTING_STATUSES,
  queryLeadStage: LEAD_STAGES,
  querySales: SALES_STATUSES,
  seat: SEAT_STATUSES,
  ticketing: CANONICAL_TICKET_STATUSES,
  tourManager: TOUR_MANAGER_STATUSES,
  visa: VISA_STATUSES,
} as const satisfies Record<StatusDomain, readonly string[]>;

function presentation(
  semanticTone: SemanticTone,
  meaning: string,
  badgeTone?: BadgeTone
): StatusPresentation {
  return {
    badgeTone: badgeTone ?? badgeToneForSemantic(semanticTone),
    meaning,
    semanticTone,
  };
}

function badgeToneForSemantic(semanticTone: SemanticTone): BadgeTone {
  switch (semanticTone) {
    case "positive":
      return "green";
    case "progress":
    case "warning":
      return "amber";
    case "danger":
      return "red";
    case "info":
      return "blue";
    default:
      return "gray";
  }
}

function fallbackPresentation(status: string): StatusPresentation {
  return presentation("neutral", `Status: ${status}`);
}

function inferCrossCuttingPresentation(status: string): StatusPresentation | null {
  const normalized = status.trim();
  const lower = normalized.toLowerCase();

  if (lower.includes("unassigned")) {
    return presentation("warning", `${normalized} — owner assignment required`);
  }
  if (lower === "overdue" || lower.startsWith("overdue ")) {
    return presentation("danger", "Overdue — action required urgently");
  }
  if (lower === "blocked" || lower.startsWith("blocked ")) {
    return presentation("danger", "Blocked — review required before proceeding");
  }
  if (lower === "waiting" || lower.startsWith("waiting ")) {
    return presentation("warning", "Waiting — follow-up required");
  }
  if (lower === "pending" || lower.endsWith(" pending")) {
    return presentation("warning", "Pending — awaiting action");
  }

  return null;
}

const WITH_SALES_PRESENTATION = presentation("info", "With Sales — awaiting Sales Decision");

const DOMAIN_STATUS_MAP: Record<StatusDomain, Record<string, StatusPresentation>> = {
  approval: {
    Approved: presentation("positive", "Approved — no open exception"),
    "Needs Info": presentation("warning", "Needs info — additional details required"),
    Pending: presentation("warning", "Pending decision — approval required"),
    Rejected: presentation("danger", "Rejected — review required"),
  },
  calling: {
    Done: presentation("positive", "Calling complete"),
    "No response": presentation("warning", "No response — follow-up calling required"),
    Pending: presentation("warning", "Calling pending"),
  },
  dashboardReadiness: {
    "Docs pending": presentation("warning", "Documents pending before departure"),
    Ready: presentation("positive", "Ready for departure — tickets and visas complete"),
    Ticketing: presentation("progress", "Ticketing in progress — visas ready"),
  },
  expense: {
    Approved: presentation("positive", "Approved — reimbursement can proceed"),
    "Needs Info": presentation("warning", "Needs info — additional expense details required"),
    Pending: presentation("warning", "Pending decision — expense approval required"),
    Rejected: presentation("danger", "Rejected — expense blocked"),
  },
  invoice: {
    Draft: presentation("neutral", "Draft invoice — not generated yet"),
    Generated: presentation("progress", "Generated — payment not received"),
    Overdue: presentation("danger", "Overdue — payment required urgently"),
    Paid: presentation("positive", "Paid — invoice settled"),
    "Part Paid": presentation("warning", "Part paid — balance outstanding"),
  },
  jobCard: {
    Closed: presentation("neutral", "Closed — job card completed"),
    "In Operations": presentation("progress", "In operations — pre-departure work underway"),
    "On Tour": presentation("positive", "On tour — travellers in market"),
    Open: presentation("progress", "Open — job card work started"),
    "Ready for Departure": presentation("positive", "Ready for departure"),
  },
  leave: {
    Approved: presentation("positive", "Approved — leave granted"),
    Pending: presentation("warning", "Pending decision — leave approval required"),
    Rejected: presentation("danger", "Rejected — leave declined"),
  },
  leaveReview: {
    Approved: presentation("positive", "Approved — review complete"),
    Pending: presentation("warning", "Pending decision — review required"),
    Rejected: presentation("danger", "Rejected — review declined"),
  },
  proposal: {
    Accepted: presentation("positive", "Accepted — no open exception"),
    Draft: presentation("progress", "Draft — proposal not sent"),
    Rejected: presentation("danger", "Rejected — proposal blocked"),
    Sent: WITH_SALES_PRESENTATION,
    "Sent to Client": presentation("positive", "Sent to client — delivery recorded"),
    "With Sales": WITH_SALES_PRESENTATION,
  },
  queryContracting: {
    "Change in destination": presentation("danger", "Blocked — destination change required"),
    "Date/Destination Change Required": presentation("danger", "Blocked — sales revision required"),
    "Order Confirmed": presentation("positive", "Order confirmed — operations handoff"),
    "Order Lost": presentation("danger", "Order lost — no further work"),
    "Proposal in progress": presentation("progress", "Proposal in progress — costing underway"),
    "Proposal sent": WITH_SALES_PRESENTATION,
    "Query Received": presentation("warning", "Query received — contracting not started"),
  },
  queryLeadStage: {
    Confirmation: presentation("positive", "Confirmation stage — order nearing completion"),
    Inquiry: presentation("progress", "Inquiry stage — sales qualification in progress"),
    Lost: presentation("danger", "Lost — query closed without order"),
    Negotiation: presentation("progress", "Negotiation stage — terms under review", "purple"),
    Proposal: presentation("progress", "Proposal stage — commercial work underway"),
  },
  querySales: {
    "Change in destination": presentation("danger", "Blocked — destination change required"),
    "Date/Destination Change Required": presentation("danger", "Blocked — sales revision required"),
    "Order Confirmed": presentation("positive", "Order confirmed"),
    "Order Lost": presentation("danger", "Order lost — sales closed"),
    "Proposal in discussion": presentation(
      "progress",
      "Proposal in discussion — sales review underway"
    ),
  },
  seat: {
    Assigned: presentation("positive", "Assigned — seat allocated"),
    Available: presentation("positive", "Available — seat open"),
    Blocked: presentation("danger", "Blocked — seat unavailable"),
    Held: presentation("warning", "Held — seat reserved pending confirmation"),
  },
  ticketing: {
    Cancelled: presentation("info", "Cancelled — review refund requirements"),
    Issued: presentation("positive", "Issued — no open exception"),
    "Name Change Required": presentation("danger", "Blocked — name change required", "purple"),
    "Pending Issue": presentation("warning", "Pending issue — ticket not issued"),
    "Refund Pending": presentation("warning", "Refund pending"),
    Refunded: presentation("neutral", "Refunded — no open exception"),
    "Reissue Required": presentation("danger", "Blocked — reissue required", "purple"),
  },
  tourManager: {
    Assigned: presentation("positive", "Assigned — tour manager allocated"),
    Available: presentation("positive", "Available — tour manager ready"),
    Inactive: presentation("danger", "Inactive — tour manager unavailable"),
  },
  visa: {
    "Appointment Scheduled": presentation("progress", "Appointment scheduled — submission pending"),
    Approved: presentation("positive", "Approved — visa granted"),
    Awaiting: presentation("warning", "Awaiting — embassy decision pending"),
    "Checklist Shared": presentation("progress", "Checklist shared — documents gathering"),
    "Documents Pending": presentation("warning", "Documents pending — traveller action required"),
    "Documents Verified": presentation("progress", "Documents verified — submission next"),
    "Not Required": presentation("neutral", "Not required — visa not needed"),
    "Not Started": presentation("warning", "Not started — visa process pending"),
    "Re-applied": presentation("warning", "Re-applied — follow embassy outcome", "purple"),
    Rejected: presentation("danger", "Rejected — visa blocked"),
    Submitted: presentation("progress", "Submitted — awaiting embassy decision"),
  },
};

const LEGACY_STATUS_ALIASES: Record<string, StatusPresentation> = {
  Active: presentation("positive", "Active — in progress"),
  Assigned: presentation("positive", "Assigned — owner allocated"),
  Available: presentation("positive", "Available"),
  Awaiting: presentation("warning", "Awaiting — follow-up required"),
  Blocked: presentation("danger", "Blocked — review required before proceeding"),
  Cancelled: presentation("danger", "Cancelled — review required"),
  Closed: presentation("neutral", "Closed — no further work"),
  Confirmation: presentation("positive", "Confirmation stage — order nearing completion"),
  Done: presentation("positive", "Done — complete"),
  Held: presentation("warning", "Held — pending confirmation"),
  Inactive: presentation("danger", "Inactive — unavailable"),
  Inquiry: presentation("progress", "Inquiry stage — sales qualification in progress"),
  Lost: presentation("danger", "Lost — closed without success"),
  Negotiation: presentation("progress", "Negotiation stage — terms under review", "purple"),
  Open: presentation("progress", "Open — work started"),
  Overdue: presentation("danger", "Overdue — action required urgently"),
  Paid: presentation("positive", "Paid — settled"),
  Pending: presentation("warning", "Pending — awaiting action"),
  Proposal: presentation("progress", "Proposal stage — commercial work underway"),
  Rejected: presentation("danger", "Rejected — review required"),
  Sent: WITH_SALES_PRESENTATION,
  Ticketing: presentation("progress", "Ticketing in progress"),
};

export function getStatusPresentation(
  domain: StatusDomain,
  status: string | null | undefined
): StatusPresentation {
  const normalized = String(status ?? "").trim();
  if (!normalized) {
    return presentation("neutral", "Status not set");
  }

  const domainPresentation = DOMAIN_STATUS_MAP[domain][normalized];
  if (domainPresentation) {
    return domainPresentation;
  }

  const crossCutting = inferCrossCuttingPresentation(normalized);
  if (crossCutting) {
    return crossCutting;
  }

  const legacy = LEGACY_STATUS_ALIASES[normalized];
  if (legacy) {
    return legacy;
  }

  return fallbackPresentation(normalized);
}

export function getStatusBadgeTone(
  domain: StatusDomain,
  status: string | null | undefined
): BadgeTone {
  return getStatusPresentation(domain, status).badgeTone;
}

export function getStatusAttentionTone(
  domain: StatusDomain,
  status: string | null | undefined
): "danger" | "info" | "warning" | undefined {
  const { semanticTone } = getStatusPresentation(domain, status);
  if (semanticTone === "danger") {
    return "danger";
  }
  if (semanticTone === "warning") {
    return "warning";
  }
  if (semanticTone === "info") {
    return "info";
  }
}
