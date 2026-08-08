import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { toNumber } from "@/lib/portal/formUtils";
import { normalizedTicketingScope } from "./shared";

export function createCommercialModalCommands(deps) {
  return {
    addJobCardCollaborator: async (form) =>
      await deps.addJobCardCollaborator({
        jobCardId: form.jobCardId || form.entityId,
        staffId: form.staffId,
      }),
    addProposalCollaborator: async (form) =>
      await deps.addProposalCollaborator({
        proposalId: form.proposalId || form.entityId,
        staffId: form.staffId,
      }),
    assignContracting: async (form) =>
      await deps.assignContracting({ queryId: form.queryId, staffId: form.staffId }),
    assignContractingOwner: async (form) =>
      await deps.assignContractingOwner({ jobCardId: form.jobCardId, staffId: form.staffId }),
    assignJobCardCreator: async (form) =>
      await deps.assignJobCardCreator({ queryId: form.queryId, staffId: form.staffId }),
    assignOperationsOwner: async (form) =>
      await deps.assignOperationsOwner({ jobCardId: form.jobCardId, staffId: form.staffId }),
    assignQueryTeams: async (form) => {
      const contractingStaffId = String(form.staffId ?? "").trim();
      const ticketingStaffId = String(form.ticketingStaffId ?? "").trim();
      await deps.assignQueryTeams({
        contractingStaffId: contractingStaffId || undefined,
        queryId: form.queryId,
        ticketingScope: normalizedTicketingScope(form.ticketingScope),
        ticketingStaffId: ticketingStaffId || undefined,
      });
    },
    assignQueryTicketing: async (form) =>
      await deps.assignQueryTicketing({
        queryId: form.queryId,
        staffId: form.ticketingStaffId || form.staffId,
      }),
    assignTicketingOwner: async (form) =>
      await deps.assignTicketingOwner({ jobCardId: form.jobCardId, staffId: form.staffId }),
    jobCard: async (form) => {
      const payload = {
        clientName: form.clientName,
        confirmedPax: toNumber(form.confirmedPax, 1),
        destination: form.destination,
        roomCount: toNumber(form.roomCount, 0),
        travelEndDate: form.travelEndDate,
        travelStartDate: form.travelStartDate,
      };
      if (form.entityId) {
        await deps.updateJobCard({ jobCardId: form.entityId, ...payload });
      } else {
        await deps.createJobCard({
          ...payload,
          proposalId: form.proposalId || undefined,
          queryId: form.queryId,
        });
      }
    },
    proposal: async (form) => {
      const queryIds =
        Array.isArray(form.queryIds) && form.queryIds.length > 0
          ? form.queryIds
          : form.queryId
            ? [form.queryId]
            : [];
      const payload = {
        airfarePerPax: toNumber(form.airfarePerPax, 0),
        clientName: form.clientName,
        itinerarySummary: form.itinerarySummary,
        landCostPerPax: toNumber(form.landCostPerPax, 0),
        queryIds,
        sellingPrice: toNumber(form.sellingPrice, 0),
        visaCostPerPax: toNumber(form.visaCostPerPax, 0),
        ...(form.taxRate === ""
          ? form.entityId
            ? { taxRate: null }
            : {}
          : { taxRate: toNumber(form.taxRate, 0) }),
      };
      if (form.entityId) {
        await deps.updateProposal({ proposalId: form.entityId, ...payload });
      } else {
        await deps.createProposal(payload);
      }
    },
    query: async (form) => {
      const travelInBatches = form.travelInBatches === "Yes" || form.travelInBatches === true;
      const payload = {
        batchingNotes: travelInBatches ? form.batchingNotes : "",
        budgetAmount: toNumber(form.budgetAmount, 0),
        clientName: form.clientName,
        contactMobile: form.contactMobile,
        contactPerson: form.contactPerson,
        destination: form.destination,
        notes: form.notes,
        paxCount: toNumber(form.paxCount, 1),
        queryType: form.queryType,
        salesOwnerName: form.salesOwnerName,
        salesOwnerStaffId: form.salesOwnerStaffId || undefined,
        source: form.source,
        travelEndDate: form.travelEndDate,
        travelInBatches,
        travelStartDate: form.travelStartDate,
        travelType: form.travelType,
      };
      if (form.entityId) {
        await deps.updateQuery({ queryId: form.entityId, ...payload });
        return;
      }
      const created = await deps.createQuery({
        ...payload,
        contractingStaffId: form.staffId || undefined,
        ticketingScope: normalizedTicketingScope(form.ticketingScope),
      });
      if (deps.pendingQueryFiles.length > 0) {
        await deps.uploadQueryFiles({
          attachQueryFile: deps.attachQueryFile,
          files: deps.pendingQueryFiles,
          generateUploadUrl: deps.generateQueryUploadUrl,
          queryId: created.id,
        });
      }
    },
    queryStatus: async (form) => {
      const payload = { queryId: form.queryId };
      if (deps.has(P.MANAGE_CONTRACTING)) {
        payload.contractingStatus = form.contractingStatus;
        payload.contractingLandCost = toNumber(form.contractingLandCost, 0);
        payload.contractingAirlinesCost = toNumber(form.contractingAirlinesCost, 0);
        payload.contractingVisaCost = toNumber(form.contractingVisaCost, 0);
      }
      await deps.updateQueryStatus(payload);
    },
    removeJobCardCollaborator: async (form) =>
      await deps.removeJobCardCollaborator({
        jobCardId: form.jobCardId || form.entityId,
        staffId: form.staffId,
      }),
    removeProposalCollaborator: async (form) =>
      await deps.removeProposalCollaborator({
        proposalId: form.proposalId || form.entityId,
        staffId: form.staffId,
      }),
    salesDecision: async (form) => {
      const decision = form.salesDecision || form.salesStatus || "Proposal in discussion";
      const payload = {
        leadStage:
          decision === "Order Confirmed"
            ? "Confirmation"
            : decision === "Order Lost"
              ? "Lost"
              : decision === "Date/Destination Change Required"
                ? "Negotiation"
                : "Proposal",
        lostReason: decision === "Order Lost" ? form.lostReason : undefined,
        queryId: form.queryId,
        salesStatus: decision,
      };
      if (decision === "Date/Destination Change Required") {
        payload.destination = form.destination;
        payload.travelEndDate = form.travelEndDate;
        payload.travelStartDate = form.travelStartDate;
      }
      if (decision === "Order Confirmed") {
        payload.airfarePerPax = toNumber(form.airfarePerPax, 0);
        payload.confirmedPax = toNumber(form.confirmedPax, 1);
        payload.destination = form.destination;
        payload.landCostPerPax = toNumber(form.landCostPerPax, 0);
        payload.proposalId = form.proposalId;
        payload.sellingPricePerPax = toNumber(form.sellingPricePerPax, 0);
        payload.travelEndDate = form.travelEndDate;
        payload.travelStartDate = form.travelStartDate;
        payload.visaCostPerPax = toNumber(form.visaCostPerPax, 0);
      }
      const queryRow = deps.queries.find((query) => query.id === form.queryId);
      const confirmed =
        decision === "Order Confirmed" ||
        queryRow?.salesStatus === "Order Confirmed" ||
        queryRow?.contractingStatus === "Order Confirmed";
      if (confirmed && form.approxMargin !== "") {
        payload.approxMargin = toNumber(form.approxMargin, 0);
      }
      await deps.updateQueryStatus(payload);
    },
  };
}
