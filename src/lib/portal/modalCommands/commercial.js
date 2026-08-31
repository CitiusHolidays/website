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
        const openingVarianceReasons = Object.fromEntries(
          [
            ["confirmedPax", "_openingSourceConfirmedPax", "openingConfirmedPaxReason"],
            ["destination", "_openingSourceDestination", "openingDestinationReason"],
            ["travelEndDate", "_openingSourceTravelEndDate", "openingTravelEndDateReason"],
            ["travelStartDate", "_openingSourceTravelStartDate", "openingTravelStartDateReason"],
          ].flatMap(([field, sourceField, reasonField]) => {
            const changed = String(form[field] ?? "") !== String(form[sourceField] ?? "");
            const reason = String(form[reasonField] ?? "").trim();
            return changed && reason ? [[field, reason]] : [];
          })
        );
        await deps.createJobCard({
          ...payload,
          confirmedOfferId: form.confirmedOfferId,
          openingVarianceReasons,
          proposalId: form.proposalId,
          proposalQueryHandoffId: form.proposalQueryHandoffId,
          proposalRevision: Number(form.proposalRevision),
          queryId: form.queryId,
        });
      }
    },
    proposal: async (form) => {
      const { queryIds: formQueryIds } = form;
      let queryIds = [];
      if (Array.isArray(formQueryIds) && formQueryIds.length > 0) {
        queryIds = formQueryIds;
      } else if (form.queryId) {
        queryIds = [form.queryId];
      }
      let taxRatePatch = {};
      if (form.taxRate === "") {
        if (form.entityId) {
          taxRatePatch = { taxRate: null };
        }
      } else {
        taxRatePatch = { taxRate: toNumber(form.taxRate, 0) };
      }
      const payload = {
        airfarePerPax: toNumber(form.airfarePerPax, 0),
        clientName: form.clientName,
        itinerarySummary: form.itinerarySummary,
        landCostPerPax: toNumber(form.landCostPerPax, 0),
        queryIds,
        sellingPrice: toNumber(form.sellingPrice, 0),
        visaCostPerPax: toNumber(form.visaCostPerPax, 0),
        ...taxRatePatch,
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
      await deps.updateContractingProgress(payload);
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
        lostReason: decision === "Order Lost" ? form.lostReason : undefined,
        lostReasonOther: decision === "Order Lost" ? form.lostReasonOther : undefined,
        proposalId: form.proposalId,
        proposalRevision: Number(form.proposalRevision),
        queryId: form.queryId,
        salesStatus: decision,
      };
      if (decision === "Date/Destination Change Required") {
        payload.destination = form.destination;
        payload.reason = form.reason;
        payload.travelEndDate = form.travelEndDate;
        payload.travelStartDate = form.travelStartDate;
      }
      if (decision === "Order Confirmed") {
        payload.confirmedPax = toNumber(form.confirmedPax, 1);
        payload.destination = form.destination;
        payload.travelEndDate = form.travelEndDate;
        payload.travelStartDate = form.travelStartDate;
      }
      const queryRow = deps.queries.find((query) => query.id === form.queryId);
      const confirmed =
        decision === "Order Confirmed" ||
        queryRow?.salesStatus === "Order Confirmed" ||
        queryRow?.contractingStatus === "Order Confirmed";
      if (confirmed && form.approxMargin !== "") {
        payload.approxMargin = toNumber(form.approxMargin, 0);
      }
      await deps.applySalesDecision(payload);
    },
  };
}
