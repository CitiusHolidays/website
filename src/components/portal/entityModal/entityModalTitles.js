"use client";

import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import { usesSalesInitialAssignmentForm } from "@/lib/portal/permissions";

const P = PORTAL_PERMISSIONS;

export function getEntityModalTitle(modal, form, has, access) {
  if (!modal) return "";
  return (
    {
      query: form.entityId ? "Edit Query" : "New Query / Enquiry",
      queryAttachments: `Attachments — ${form.queryCode || "Query"}`,
      proposalAttachments: `Working Files — ${form.queryCode || "Proposal"}`,
      proposalFinalizedPdf: `Finalized Proposal PDF — ${form.queryCode || "Proposal"}`,
      assignContracting: "Assign Contracting SPOC",
      assignQueryTeams: usesSalesInitialAssignmentForm(access)
        ? "Assign Contracting SPOC & Ticketing Scope"
        : "Assign contracting & ticketing teams",
      assignQueryTicketing: "Assign Ticketing SPOC",
      assignJobCardCreator: "Assign Job Card Creator",
      addProposalCollaborator: "Add Proposal Collaborator",
      removeProposalCollaborator: "Remove Proposal Collaborator",
      addJobCardCollaborator: "Add Job Card Collaborator",
      removeJobCardCollaborator: "Remove Job Card Collaborator",
      assignContractingOwner: "Assign Contracting SPOC",
      assignOperationsOwner: "Assign Operations Owner",
      assignTicketingOwner: "Assign Ticketing Owner",
      queryStatus: "Update Query Status",
      salesDecision: "Sales Decision",
      proposal: form.entityId ? "Edit Proposal" : "Create Proposal",
      jobCard: form.entityId ? "Edit Job Card" : "Open Job Card",
      travelBatch: form.entityId ? "Edit Travel Batch" : "Add Travel Batch",
      traveller: form.entityId ? "Edit Traveller" : "Add Traveller",
      visa: form.entityId ? "Edit Visa Record" : "Update Visa Status",
      visa_create: "Create Visa Record",
      pnr: form.entityId ? "Edit PNR" : "Add PNR",
      ticket: form.entityId ? "Edit Ticket" : "Issue Ticket",
      seat: form.entityId ? "Edit Seat Allocation" : "Save Seat Allocation",
      hotel: form.entityId ? "Edit Hotel" : "Add Hotel",
      tourManager: form.entityId ? "Edit Tour Manager" : "Add Tour Manager",
      invoice: form.entityId ? "Edit Invoice" : "Generate Invoice",
      expense: form.entityId ? "Edit Expense" : "Add Expense",
      staff: "Staff Allowlist Entry",
      leave_create: form.entityId
        ? "Edit Leave"
        : has(P.MANAGE_LEAVE)
          ? "Record Employee Leave"
          : "Request Leave",
      approvalDecide:
        form.approvalStatus === "Needs Info" ? "Request More Details" : "Reject Approval",
    }[modal] || ""
  );
}
