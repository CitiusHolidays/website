"use client";

export const ENTITY_MODAL_SECTION_META = {
  addJobCardCollaborator: { description: "Choose a staff member for this Job Card." },
  addProposalCollaborator: { description: "Choose a staff member for this Proposal." },
  approvalDecide: { description: "Record the decision and add notes when needed." },
  assignContracting: { description: "Choose the Contracting SPOC for this Query." },
  assignContractingOwner: { description: "Choose the Contracting SPOC for this record." },
  assignJobCardCreator: {
    description: "Choose who will open the Job Card for this confirmed Query.",
  },
  assignOperationsOwner: { description: "Choose the Operations SPOC for this record." },
  assignQueryTeams: {
    description: "Choose the Contracting and Ticketing owners for this Query.",
  },
  assignQueryTicketing: { description: "Choose the Ticketing SPOC for this Query." },
  assignTicketingOwner: { description: "Choose the Ticketing SPOC for this record." },
  expense: { description: "Record the amount, payment method, date, and supporting file." },
  hotel: { description: "Add the property, city, dates, and room details." },
  invoice: { description: "Add the invoice number, amount, due date, and status." },
  jobCard: { description: "Open or update the Job Card for this confirmed Query." },
  leave_create: {
    description: "Choose the leave type and dates, then review the available balance.",
  },
  pnr: { description: "Add the PNR, airline, route, and travel dates." },
  proposal: { description: "Add costs, tax, itinerary details, and the Proposal Doc." },
  proposalAttachments: { description: "Upload or remove working files for this Proposal." },
  proposalFinalizedPdf: {
    description: "Upload or replace the Proposal Doc linked to this Proposal.",
  },
  query: { description: "Add the enquiry, trip details, and initial owners." },
  queryAttachments: { description: "Upload or remove files for this Query." },
  queryStatus: { description: "Update Contracting Progress and add a note when needed." },
  removeJobCardCollaborator: {
    description: "Choose the collaborator to remove from this Job Card.",
  },
  removeProposalCollaborator: {
    description: "Choose the collaborator to remove from this Proposal.",
  },
  salesDecision: { description: "Record the Sales Decision and any follow-up details." },
  seat: { description: "Link the Traveller and PNR, then record the seat status." },
  staff: {
    description: "Update staff access, reporting lines, leave settings, and alert roles.",
  },
  ticket: { description: "Add the ticket, Traveller, PNR, fare, and issue status." },
  tourManager: { description: "Assign a Tour Manager, dates, and reporting instructions." },
  travelBatch: { description: "Set dates, pax, owners, and status for this series." },
  traveller: { description: "Add Traveller identity, rooming, meal, and travel details." },
  visa: { description: "Update the Traveller's visa status and notes." },
  visa_create: { description: "Link a new visa record to the Traveller and Job Card." },
};

export function getEntityModalSectionMeta(modal) {
  return ENTITY_MODAL_SECTION_META[modal] || null;
}
