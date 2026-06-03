"use client";

import {
  ContractingCostFields,
  FinalizedProposalPdfPanel,
  Input,
  isQueryConfirmed,
  MAX_QUERY_NOTES_WORDS,
  MultiSelect,
  money,
  proposalCostPerPax,
  QueryAttachmentsPanel,
  QueryFilePicker,
  Select,
  Textarea,
} from "@/components/portal/PortalModalForm";
import {
  CONTRACTING_STATUS_SELECT_OPTIONS,
  LOST_REASONS,
  QUERY_SOURCES,
  SALES_DECISION_OPTIONS,
  TRAVEL_TYPES,
} from "@/lib/portal/constants";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";
import {
  canAssignContracting,
  canAssignQueryTicketing,
  canAssignTicketing,
  getQueryTypeOptions,
} from "@/lib/portal/permissions";

export function EntityModalJobCardFields({
  modal,
  form,
  updateForm,
  patchForm,
  has,
  access,
  queries,
  proposals,
  jobCards,
  team,
  contractingTeamOptions,
  operationsTeamOptions,
  ticketingTeamOptions,
  pendingQueryFiles,
  setPendingQueryFiles,
  pendingProposalFiles,
  setPendingProposalFiles,
  generateQueryUploadUrl,
  attachQueryFile,
  getQueryAttachmentUrl,
  removeQueryAttachment,
  generateProposalUploadUrl,
  attachProposalFile,
  getProposalAttachmentUrl,
  removeProposalAttachment,
  generateFinalizedPdfUploadUrl,
  attachFinalizedPdf,
  getFinalizedPdfUrl,
  removeFinalizedPdf,
  handleProposalQuerySelect,
  handleJobQuerySelect,
  handleJobCardSelect,
  handleTravellerSelect,
}) {
  return (
    <>
      {modal === "jobCard" && (
        <>
          <Select
            label="Confirmed Query"
            value={form.queryId}
            options={[
              { value: "", label: "Select confirmed query…" },
              ...queries.reduce((options, q) => {
                if (
                  q.salesStatus === "Order Confirmed" ||
                  q.contractingStatus === "Order Confirmed"
                ) {
                  options.push({
                    value: q.id,
                    label: `${q.queryCode} - ${q.clientName}`,
                  });
                }
                return options;
              }, []),
            ]}
            onChange={handleJobQuerySelect}
            required={!form.entityId}
          />
          <Select
            label="Linked Proposal"
            value={form.proposalId}
            options={[
              { value: "", label: "Select proposal…" },
              ...proposals.reduce((options, proposal) => {
                if (!form.queryId || proposalLinkedQueryIds(proposal).includes(form.queryId)) {
                  options.push({
                    value: proposal.id,
                    label: `${proposal.proposalCode} - ${proposal.status}`,
                  });
                }
                return options;
              }, []),
            ]}
            onChange={(v) => updateForm("proposalId", v)}
            required={!form.entityId}
          />
          <Input
            label="Client"
            value={form.clientName}
            onChange={(v) => updateForm("clientName", v)}
          />
          <Input
            label="Confirmed Pax"
            type="number"
            value={form.confirmedPax}
            onChange={(v) => updateForm("confirmedPax", v)}
          />
          <Input
            label="Room Count"
            type="number"
            value={form.roomCount}
            onChange={(v) => updateForm("roomCount", v)}
          />
          <Input
            label="Destination"
            value={form.destination}
            onChange={(v) => updateForm("destination", v)}
          />
          <Input
            label="Travel Start"
            type="date"
            value={form.travelStartDate}
            onChange={(v) => updateForm("travelStartDate", v)}
          />
          <Input
            label="Travel End"
            type="date"
            value={form.travelEndDate}
            onChange={(v) => updateForm("travelEndDate", v)}
          />
          <Input
            label="Tour Manager"
            value={form.tourManagerName}
            onChange={(v) => updateForm("tourManagerName", v)}
          />
        </>
      )}
    </>
  );
}
