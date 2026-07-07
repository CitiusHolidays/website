"use client";

import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import { usesSalesInitialAssignmentForm } from "@/lib/portal/permissions";

const P = PORTAL_PERMISSIONS;

export function getEntityModalTitle(modal, form, has, access) {
  if (!modal) {
    return "";
  }
  return (
    {
      addJobCardCollaborator: "Add Job Card Collaborator",
      addProposalCollaborator: "Add Proposal Collaborator",
      approvalDecide:
        form.approvalStatus === "Needs Info" ? "Request More Details" : "Reject Approval",
      assignContracting: "Assign Contracting SPOC",
      assignContractingOwner: "Assign Contracting SPOC",
      assignJobCardCreator: "Assign Job Card Creator",
      assignOperationsOwner: "Assign Operations Owner",
      assignQueryTeams: usesSalesInitialAssignmentForm(access)
        ? "Assign Contracting SPOC & Ticketing Scope"
        : "Assign contracting & ticketing teams",
      assignQueryTicketing: "Assign Ticketing SPOC",
      assignTicketingOwner: "Assign Ticketing Owner",
      expense: form.entityId ? "Edit Expense" : "Add Expense",
      hotel: form.entityId ? "Edit Hotel" : "Add Hotel",
      invoice: form.entityId ? "Edit Invoice" : "Generate Invoice",
      jobCard: form.entityId ? "Edit Job Card" : "Open Job Card",
      leave_create: form.entityId
        ? "Edit Leave"
        : has(P.MANAGE_LEAVE)
          ? "Record Employee Leave"
          : "Request Leave",
      pnr: form.entityId ? "Edit PNR" : "Add PNR",
      proposal: form.entityId ? "Edit Proposal" : "Create Proposal",
      proposalAttachments: `Working Files — ${form.queryCode || "Proposal"}`,
      proposalFinalizedPdf: `Finalized Proposal PDF — ${form.queryCode || "Proposal"}`,
      query: form.entityId ? "Edit Query" : "New Query / Enquiry",
      queryAttachments: `Attachments — ${form.queryCode || "Query"}`,
      queryStatus: "Update Query Status",
      removeJobCardCollaborator: "Remove Job Card Collaborator",
      removeProposalCollaborator: "Remove Proposal Collaborator",
      salesDecision: "Sales Decision",
      seat: form.entityId ? "Edit Seat Allocation" : "Save Seat Allocation",
      staff: "Staff Allowlist Entry",
      ticket: form.entityId ? "Edit Ticket" : "Issue Ticket",
      tourManager: form.entityId ? "Edit Tour Manager" : "Add Tour Manager",
      travelBatch: form.entityId ? "Edit Travel Batch" : "Add Travel Batch",
      traveller: form.entityId ? "Edit Traveller" : "Add Traveller",
      visa: form.entityId ? "Edit Visa Record" : "Update Visa Status",
      visa_create: "Create Visa Record",
    }[modal] || ""
  );
}
