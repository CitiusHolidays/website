"use client";

export const ENTITY_MODAL_SECTION_META = {
  addJobCardCollaborator: {
    description: "Invite another staff member to collaborate on this job card.",
    eyebrow: "Collaboration",
    title: "Add collaborator",
  },
  addProposalCollaborator: {
    description: "Invite another staff member to collaborate on this proposal.",
    eyebrow: "Collaboration",
    title: "Add collaborator",
  },
  approvalDecide: {
    description: "Record the approval outcome and any notes for the requester.",
    eyebrow: "Approval",
    title: "Decision details",
  },
  assignContracting: {
    description: "Choose the contracting SPOC responsible for this query.",
    eyebrow: "Assignment",
    title: "Contracting handoff",
  },
  assignContractingOwner: {
    description: "Choose the contracting SPOC responsible for this record.",
    eyebrow: "Assignment",
    title: "Contracting SPOC",
  },
  assignJobCardCreator: {
    description: "Assign who will open and own the job card for this confirmed query.",
    eyebrow: "Assignment",
    title: "Job card creator",
  },
  assignOperationsOwner: {
    description: "Choose the operations SPOC for delivery coordination.",
    eyebrow: "Assignment",
    title: "Operations handoff",
  },
  assignQueryTeams: {
    description: "Set contracting and ticketing ownership for this query.",
    eyebrow: "Assignment",
    title: "Team assignment",
  },
  assignQueryTicketing: {
    description: "Choose the ticketing SPOC for this query.",
    eyebrow: "Assignment",
    title: "Ticketing handoff",
  },
  assignTicketingOwner: {
    description: "Choose the ticketing SPOC for this record.",
    eyebrow: "Assignment",
    title: "Ticketing SPOC",
  },
  expense: {
    description: "Capture expense details linked to the selected job card or query.",
    eyebrow: "Finance",
    title: "Expense details",
  },
  hotel: {
    description: "Record hotel allocation and rooming details for the job card.",
    eyebrow: "Operations",
    title: "Hotel details",
  },
  invoice: {
    description: "Generate or update invoice details for the selected job card.",
    eyebrow: "Finance",
    title: "Invoice details",
  },
  jobCard: {
    description: "Open or update the operational job card for a confirmed query.",
    eyebrow: "Accounts",
    title: "Job card details",
  },
  leave_create: {
    description: "Submit leave dates, type, and approver context.",
    eyebrow: "HR",
    title: "Leave request",
  },
  pnr: {
    description: "Capture PNR and flight group details for ticketing.",
    eyebrow: "Ticketing",
    title: "PNR details",
  },
  proposal: {
    description: "Build costing, itinerary context, and sales handoff details.",
    eyebrow: "Contracting",
    title: "Proposal details",
  },
  proposalAttachments: {
    description: "Upload or remove working files for this proposal.",
    eyebrow: "Files",
    title: "Working files",
  },
  proposalFinalizedPdf: {
    description: "Upload or replace the proposal document for linked queries.",
    eyebrow: "Files",
    title: "Proposal Document",
  },
  queryAttachments: {
    description: "Upload or remove supporting documents for this query.",
    eyebrow: "Files",
    title: "Attachments",
  },
  queryStatus: {
    description: "Update contracting workflow status and internal notes.",
    eyebrow: "Workflow",
    title: "Status update",
  },
  removeJobCardCollaborator: {
    description: "Remove a collaborator from this job card.",
    eyebrow: "Collaboration",
    title: "Remove collaborator",
  },
  removeProposalCollaborator: {
    description: "Remove a collaborator from this proposal.",
    eyebrow: "Collaboration",
    title: "Remove collaborator",
  },
  salesDecision: {
    description: "Record the sales outcome and any follow-up context.",
    eyebrow: "Sales",
    title: "Sales decision",
  },
  seat: {
    description: "Save seat allocation details for the selected flight group.",
    eyebrow: "Ticketing",
    title: "Seat allocation",
  },
  staff: {
    description: "Add or update a staff allowlist entry and portal access.",
    eyebrow: "Settings",
    title: "Staff profile",
  },
  ticket: {
    description: "Issue or update ticket details for the traveller and PNR.",
    eyebrow: "Ticketing",
    title: "Ticket details",
  },
  tourManager: {
    description: "Assign tour manager contact and batch coverage.",
    eyebrow: "Operations",
    title: "Tour manager",
  },
  travelBatch: {
    description: "Define a travel batch within the job card.",
    eyebrow: "Operations",
    title: "Travel batch",
  },
  traveller: {
    description: "Capture traveller profile, rooming, and travel preferences.",
    eyebrow: "Operations",
    title: "Traveller profile",
  },
  visa: {
    description: "Update visa status and processing details.",
    eyebrow: "Visa",
    title: "Visa status",
  },
  visa_create: {
    description: "Create a visa record linked to the traveller and job card.",
    eyebrow: "Visa",
    title: "Visa record",
  },
};

export function getEntityModalSectionMeta(modal) {
  return ENTITY_MODAL_SECTION_META[modal] || null;
}
