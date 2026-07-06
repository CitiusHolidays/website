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
  TICKETING_SCOPE_OPTIONS,
  TRAVEL_TYPES,
} from "@/lib/portal/constants";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";
import {
  canAssignContracting,
  canAssignQueryTicketing,
  canAssignTicketing,
  getQueryTypeOptions,
} from "@/lib/portal/permissions";

const TICKETING_SCOPE_SELECT_OPTIONS = [
  { value: "", label: "Select Ticketing Scope..." },
  ...TICKETING_SCOPE_OPTIONS.map((scope) => ({ value: scope, label: scope })),
];

const TRAVEL_IN_BATCHES_OPTIONS = [
  { value: "No", label: "No" },
  { value: "Yes", label: "Yes" },
];

export function EntityModalQueryFields({
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
      {modal === "query" && (
        <>
          <Input
            label="Client / Company"
            value={form.clientName}
            onChange={(v) => updateForm("clientName", v)}
            required
          />
          <Input
            label="Contact Person"
            value={form.contactPerson}
            onChange={(v) => updateForm("contactPerson", v)}
          />
          <Input
            label="Mobile"
            value={form.contactMobile}
            onChange={(v) => updateForm("contactMobile", v)}
          />
          <Input
            label="No. of Pax"
            type="number"
            value={form.paxCount}
            onChange={(v) => updateForm("paxCount", v)}
          />
          <Input
            label="Destination"
            value={form.destination}
            onChange={(v) => updateForm("destination", v)}
          />
          <Input
            label="Travel Date From"
            type="date"
            value={form.travelStartDate}
            onChange={(v) => updateForm("travelStartDate", v)}
          />
          <Input
            label="Travel Date To"
            type="date"
            value={form.travelEndDate}
            onChange={(v) => updateForm("travelEndDate", v)}
          />
          <Select
            label="Query Type"
            value={form.queryType}
            options={getQueryTypeOptions(access)}
            onChange={(v) => updateForm("queryType", v)}
          />
          <Select
            label="Travel Type"
            value={form.travelType}
            options={TRAVEL_TYPES}
            onChange={(v) => updateForm("travelType", v)}
          />
          <Input
            label="Budget INR"
            type="number"
            value={form.budgetAmount}
            onChange={(v) => updateForm("budgetAmount", v)}
          />
          <Select
            label="Source"
            value={form.source}
            options={QUERY_SOURCES}
            onChange={(v) => updateForm("source", v)}
          />
          <Select
            label="Sales Rep"
            value={form.salesOwnerName}
            options={[
              { value: "", label: "Current user" },
              ...team.reduce((options, member) => {
                if (member.roles.some((role) => ["Sales", "Sales Head"].includes(role))) {
                  options.push({ value: member.name, label: member.name });
                }
                return options;
              }, []),
            ]}
            onChange={(v) => updateForm("salesOwnerName", v)}
          />
          <Select
            label="Contracting SPOC"
            value={form.staffId}
            options={[
              { value: "", label: "Select Contracting SPOC..." },
              ...contractingTeamOptions.map((o) => ({ value: o.value, label: o.label })),
            ]}
            onChange={(v) => updateForm("staffId", v)}
          />
          <Select
            label="Ticketing Scope"
            value={form.ticketingScope}
            options={TICKETING_SCOPE_SELECT_OPTIONS}
            onChange={(v) => updateForm("ticketingScope", v)}
          />
          <Select
            label="Travel in Batches"
            value={form.travelInBatches || "No"}
            options={TRAVEL_IN_BATCHES_OPTIONS}
            onChange={(v) =>
              patchForm({
                travelInBatches: v,
                ...(v === "Yes" ? {} : { batchingNotes: "" }),
              })
            }
          />
          {form.travelInBatches === "Yes" && (
            <div className="md:col-span-2">
              <Textarea
                label="Batch Details"
                value={form.batchingNotes}
                onChange={(v) => updateForm("batchingNotes", v)}
              />
            </div>
          )}
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(v) => updateForm("notes", v)}
            maxWords={MAX_QUERY_NOTES_WORDS}
          />
          <div className="md:col-span-2">
            <QueryFilePicker
              files={pendingQueryFiles}
              onChange={setPendingQueryFiles}
              inputId="new-query-files"
            />
          </div>
        </>
      )}
    </>
  );
}
