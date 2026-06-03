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

export function EntityModalAssignFields({
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
      {modal === "assignContracting" && (
        <>
          <Select
            label="Query"
            value={form.queryId}
            options={queries.map((q) => ({
              value: q.id,
              label: `${q.queryCode} - ${q.clientName}`,
            }))}
            onChange={(v) => updateForm("queryId", v)}
            required
          />
          <Select
            label="Contracting SPOC"
            value={form.staffId}
            options={[
              { value: "", label: "Select team member…" },
              ...contractingTeamOptions.map((o) => ({ value: o.value, label: o.label })),
            ]}
            onChange={(v) => updateForm("staffId", v)}
            required
          />
        </>
      )}
      {modal === "assignQueryTicketing" && (
        <>
          <Select
            label="Query"
            value={form.queryId}
            options={queries.map((q) => ({
              value: q.id,
              label: `${q.queryCode} - ${q.clientName}`,
            }))}
            onChange={(v) => updateForm("queryId", v)}
            required
          />
          <Select
            label="Ticketing SPOC"
            value={form.ticketingStaffId}
            options={[
              { value: "", label: "Select team member…" },
              ...ticketingTeamOptions.map((o) => ({ value: o.value, label: o.label })),
            ]}
            onChange={(v) => updateForm("ticketingStaffId", v)}
            required
          />
        </>
      )}
      {modal === "assignQueryTeams" && (
        <>
          <Select
            label="Query"
            value={form.queryId}
            options={queries.map((q) => ({
              value: q.id,
              label: `${q.queryCode} - ${q.clientName}`,
            }))}
            onChange={(v) => updateForm("queryId", v)}
            required
          />
          {canAssignContracting(access) && (
            <Select
              label="Contracting SPOC"
              value={form.staffId}
              options={[
                { value: "", label: "Select contracting…" },
                ...contractingTeamOptions.map((o) => ({
                  value: o.value,
                  label: o.label,
                })),
              ]}
              onChange={(v) => updateForm("staffId", v)}
            />
          )}
          {canAssignQueryTicketing(access) && (
            <Select
              label="Ticketing SPOC"
              value={form.ticketingStaffId}
              options={[
                { value: "", label: "Select ticketing…" },
                ...ticketingTeamOptions.map((o) => ({
                  value: o.value,
                  label: o.label,
                })),
              ]}
              onChange={(v) => updateForm("ticketingStaffId", v)}
            />
          )}
          <p className="text-sm text-brand-muted">
            Assign at least one SPOC. Contracting prepares land/visa costing; ticketing prepares
            airfare inputs for the proposal.
          </p>
        </>
      )}
      {modal === "assignContractingOwner" && (
        <>
          <Select
            label="Job Card"
            value={form.jobCardId}
            options={jobCardSelectOptions(jobCards, { required: true })}
            onChange={handleJobCardSelect}
            required
          />
          <Select
            label="Contracting SPOC"
            value={form.staffId}
            options={[
              { value: "", label: "Select team member…" },
              ...contractingTeamOptions.map((o) => ({ value: o.value, label: o.label })),
            ]}
            onChange={(v) => updateForm("staffId", v)}
            required
          />
        </>
      )}
      {modal === "assignOperationsOwner" && (
        <>
          <Select
            label="Job Card"
            value={form.jobCardId}
            options={jobCardSelectOptions(jobCards, { required: true })}
            onChange={handleJobCardSelect}
            required
          />
          <Select
            label="Operations Owner"
            value={form.staffId}
            options={[
              { value: "", label: "Select team member…" },
              ...operationsTeamOptions.map((o) => ({ value: o.value, label: o.label })),
            ]}
            onChange={(v) => updateForm("staffId", v)}
            required
          />
        </>
      )}
      {modal === "assignTicketingOwner" && (
        <>
          <Select
            label="Job Card"
            value={form.jobCardId}
            options={jobCardSelectOptions(jobCards, { required: true })}
            onChange={handleJobCardSelect}
            required
          />
          <div className="md:col-span-2 flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Select
                label="Ticketing Owner"
                value={form.staffId}
                options={[
                  { value: "", label: "Select team member…" },
                  ...ticketingTeamOptions.map((o) => ({
                    value: o.value,
                    label: o.label,
                  })),
                ]}
                onChange={(v) => updateForm("staffId", v)}
                required
              />
            </div>
            {canAssignTicketing(access) && access?.staffId && (
              <button
                type="button"
                className="portal-outline-btn mb-1"
                onClick={() => updateForm("staffId", access.staffId)}
              >
                Assign to me
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
