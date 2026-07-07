"use client";

import {
  Input,
  MAX_QUERY_NOTES_WORDS,
  QueryFilePicker,
  Select,
  Textarea,
} from "@/components/portal/PortalModalForm";
import {
  QUERY_SOURCES,
  SALES_REP_ROLES,
  TICKETING_SCOPE_OPTIONS,
  TRAVEL_TYPES,
} from "@/lib/portal/constants";
import { getQueryTypeOptions } from "@/lib/portal/permissions";

const TICKETING_SCOPE_SELECT_OPTIONS = [
  { label: "Select Ticketing Scope...", value: "" },
  ...TICKETING_SCOPE_OPTIONS.map((scope) => ({ label: scope, value: scope })),
];

const TRAVEL_IN_BATCHES_OPTIONS = [
  { label: "No", value: "No" },
  { label: "Yes", value: "Yes" },
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
            onChange={(v) => updateForm("clientName", v)}
            required
            value={form.clientName}
          />
          <Input
            label="Contact Person"
            onChange={(v) => updateForm("contactPerson", v)}
            value={form.contactPerson}
          />
          <Input
            label="Mobile"
            onChange={(v) => updateForm("contactMobile", v)}
            value={form.contactMobile}
          />
          <Input
            label="No. of Pax"
            onChange={(v) => updateForm("paxCount", v)}
            type="number"
            value={form.paxCount}
          />
          <Input
            label="Destination"
            onChange={(v) => updateForm("destination", v)}
            value={form.destination}
          />
          <Input
            label="Travel Date From"
            onChange={(v) => updateForm("travelStartDate", v)}
            type="date"
            value={form.travelStartDate}
          />
          <Input
            label="Travel Date To"
            onChange={(v) => updateForm("travelEndDate", v)}
            type="date"
            value={form.travelEndDate}
          />
          <Select
            label="Query Type"
            onChange={(v) => updateForm("queryType", v)}
            options={getQueryTypeOptions(access)}
            value={form.queryType}
          />
          <Select
            label="Travel Type"
            onChange={(v) => updateForm("travelType", v)}
            options={TRAVEL_TYPES}
            value={form.travelType}
          />
          <Input
            label="Budget INR"
            onChange={(v) => updateForm("budgetAmount", v)}
            type="number"
            value={form.budgetAmount}
          />
          <Select
            label="Source"
            onChange={(v) => updateForm("source", v)}
            options={QUERY_SOURCES}
            value={form.source}
          />
          <Select
            label="Sales Rep"
            onChange={(v) => updateForm("salesOwnerName", v)}
            options={[
              { label: "Current user", value: "" },
              ...team.reduce((options, member) => {
                if (member.roles.some((role) => SALES_REP_ROLES.includes(role))) {
                  options.push({ label: member.name, value: member.name });
                }
                return options;
              }, []),
            ]}
            value={form.salesOwnerName}
          />
          <Select
            label="Contracting SPOC"
            onChange={(v) => updateForm("staffId", v)}
            options={[
              { label: "Select Contracting SPOC...", value: "" },
              ...contractingTeamOptions.map((o) => ({ label: o.label, value: o.value })),
            ]}
            value={form.staffId}
          />
          <Select
            label="Ticketing Scope"
            onChange={(v) => updateForm("ticketingScope", v)}
            options={TICKETING_SCOPE_SELECT_OPTIONS}
            value={form.ticketingScope}
          />
          <Select
            label="Travel in Series"
            onChange={(v) =>
              patchForm({
                travelInBatches: v,
                ...(v === "Yes" ? {} : { batchingNotes: "" }),
              })
            }
            options={TRAVEL_IN_BATCHES_OPTIONS}
            value={form.travelInBatches || "No"}
          />
          {form.travelInBatches === "Yes" && (
            <div className="md:col-span-2">
              <Textarea
                label="Batch Details"
                onChange={(v) => updateForm("batchingNotes", v)}
                value={form.batchingNotes}
              />
            </div>
          )}
          <Textarea
            label="Notes"
            maxWords={MAX_QUERY_NOTES_WORDS}
            onChange={(v) => updateForm("notes", v)}
            value={form.notes}
          />
          <div className="md:col-span-2">
            <QueryFilePicker
              files={pendingQueryFiles}
              inputId="new-query-files"
              onChange={setPendingQueryFiles}
            />
          </div>
        </>
      )}
    </>
  );
}
