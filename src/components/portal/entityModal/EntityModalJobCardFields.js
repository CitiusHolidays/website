"use client";

import { Input, Select } from "@/components/portal/PortalModalForm";
import { proposalLinkedQueryIds } from "@/lib/portal/proposalLinks";

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
            onChange={handleJobQuerySelect}
            options={[
              { label: "Select confirmed query…", value: "" },
              ...queries.reduce((options, q) => {
                if (
                  q.salesStatus === "Order Confirmed" ||
                  q.contractingStatus === "Order Confirmed"
                ) {
                  options.push({
                    label: `${q.queryCode} - ${q.clientName}`,
                    value: q.id,
                  });
                }
                return options;
              }, []),
            ]}
            required={!form.entityId}
            value={form.queryId}
          />
          <Select
            label="Linked Proposal"
            onChange={(v) => updateForm("proposalId", v)}
            options={[
              { label: "Select proposal…", value: "" },
              ...proposals.reduce((options, proposal) => {
                const linkedQueryIds = new Set(proposalLinkedQueryIds(proposal));
                if (!form.queryId || linkedQueryIds.has(form.queryId)) {
                  options.push({
                    label: `${proposal.proposalCode} - ${proposal.status}`,
                    value: proposal.id,
                  });
                }
                return options;
              }, []),
            ]}
            required={!form.entityId}
            value={form.proposalId}
          />
          <Input
            label="Client"
            onChange={(v) => updateForm("clientName", v)}
            value={form.clientName}
          />
          <Input
            label="Confirmed Pax"
            onChange={(v) => updateForm("confirmedPax", v)}
            type="number"
            value={form.confirmedPax}
          />
          <Input
            label="Room Count"
            onChange={(v) => updateForm("roomCount", v)}
            type="number"
            value={form.roomCount}
          />
          <Input
            label="Destination"
            onChange={(v) => updateForm("destination", v)}
            value={form.destination}
          />
          <Input
            label="Travel Start"
            onChange={(v) => updateForm("travelStartDate", v)}
            type="date"
            value={form.travelStartDate}
          />
          <Input
            label="Travel End"
            onChange={(v) => updateForm("travelEndDate", v)}
            type="date"
            value={form.travelEndDate}
          />
        </>
      )}
    </>
  );
}
