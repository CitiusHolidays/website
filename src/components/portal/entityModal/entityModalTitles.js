"use client";

import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import { usesSalesInitialAssignmentForm } from "@/lib/portal/permissions";

const P = PORTAL_PERMISSIONS;

function approvalTitle(status) {
  return status === "Needs Info" ? "Request More Details" : "Reject Approval";
}

function assignmentTitle(access) {
  return usesSalesInitialAssignmentForm(access)
    ? "Assign Contracting SPOC & Ticketing Scope"
    : "Assign contracting & ticketing teams";
}

function editOrCreateTitle(entityId, editTitle, createTitle) {
  return entityId ? editTitle : createTitle;
}

function leaveTitle(form, has) {
  if (form.entityId) {
    return "Edit Leave";
  }
  return has(P.MANAGE_LEAVE) ? "Record Employee Leave" : "Request Leave";
}

export function getEntityModalTitle(modal, form, has, access) {
  if (!modal) {
    return "";
  }
  return (
    {
      addJobCardCollaborator: "Add Job Card Collaborator",
      addProposalCollaborator: "Add Proposal Collaborator",
      approvalDecide: approvalTitle(form.approvalStatus),
      assignContracting: "Assign Contracting SPOC",
      assignContractingOwner: "Assign Contracting SPOC",
      assignJobCardCreator: "Assign Job Card Creator",
      assignOperationsOwner: "Assign Operations SPOC",
      assignQueryTeams: assignmentTitle(access),
      assignQueryTicketing: "Assign Ticketing SPOC",
      assignTicketingOwner: "Assign Ticketing SPOC",
      expense: editOrCreateTitle(form.entityId, "Edit Expense", "Add Expense"),
      hotel: editOrCreateTitle(form.entityId, "Edit Hotel", "Add Hotel"),
      invoice: editOrCreateTitle(form.entityId, "Edit Invoice", "Generate Invoice"),
      jobCard: editOrCreateTitle(form.entityId, "Edit Job Card", "Open Job Card"),
      leave_create: leaveTitle(form, has),
      pnr: editOrCreateTitle(form.entityId, "Edit PNR", "Add PNR"),
      proposal: editOrCreateTitle(form.entityId, "Edit Proposal", "Create Proposal"),
      proposalAttachments: `Working Files — ${form.queryCode || "Proposal"}`,
      proposalFinalizedPdf: `Proposal Document — ${form.queryCode || "Proposal"}`,
      query: editOrCreateTitle(form.entityId, "Edit Query", "New Query / Enquiry"),
      queryAttachments: `Attachments — ${form.queryCode || "Query"}`,
      queryStatus: "Update Query Status",
      removeJobCardCollaborator: "Remove Job Card Collaborator",
      removeProposalCollaborator: "Remove Proposal Collaborator",
      salesDecision: "Sales Decision",
      seat: editOrCreateTitle(form.entityId, "Edit Seat Allocation", "Save Seat Allocation"),
      staff: "Staff Allowlist Entry",
      ticket: editOrCreateTitle(form.entityId, "Edit Ticket", "Issue Ticket"),
      tourManager: editOrCreateTitle(form.entityId, "Edit Tour Manager", "Add Tour Manager"),
      travelBatch: editOrCreateTitle(form.entityId, "Edit Travel Batch", "Add Travel Batch"),
      traveller: editOrCreateTitle(form.entityId, "Edit Traveller", "Add Traveller"),
      visa: editOrCreateTitle(form.entityId, "Edit Visa Record", "Update Visa Status"),
      visa_create: "Create Visa Record",
    }[modal] || ""
  );
}
