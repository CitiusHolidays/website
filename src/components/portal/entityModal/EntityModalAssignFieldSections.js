"use client";

import { Select } from "@/components/portal/PortalModalForm";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";
import {
  canAssignContracting,
  canAssignQueryTicketing,
  canAssignTicketing,
} from "@/lib/portal/permissions";

function queryOptions(queries) {
  return queries.map((q) => ({
    value: q.id,
    label: `${q.queryCode} - ${q.clientName}`,
  }));
}

function confirmedQueryOptions(queries) {
  return queries.reduce((options, query) => {
    if (query.salesStatus === "Order Confirmed" || query.contractingStatus === "Order Confirmed") {
      options.push({
        value: query.id,
        label: `${query.queryCode} - ${query.clientName}`,
      });
    }
    return options;
  }, []);
}

function teamOptionsForIds(team, ids) {
  const idSet = new Set(ids ?? []);
  return team.reduce((options, member) => {
    if (idSet.has(member.id)) {
      options.push({ value: member.id, label: member.name });
    }
    return options;
  }, []);
}

export function AssignContractingFields({ form, updateForm, queries, contractingTeamOptions }) {
  return (
    <>
      <Select
        label="Query"
        value={form.queryId}
        options={queryOptions(queries)}
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
  );
}

export function AssignQueryTicketingFields({ form, updateForm, queries, ticketingTeamOptions }) {
  return (
    <>
      <Select
        label="Query"
        value={form.queryId}
        options={queryOptions(queries)}
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
  );
}

export function AssignQueryTeamsFields({
  form,
  updateForm,
  access,
  queries,
  contractingTeamOptions,
  ticketingTeamOptions,
}) {
  return (
    <>
      <Select
        label="Query"
        value={form.queryId}
        options={queryOptions(queries)}
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
        Assign at least one SPOC. Contracting prepares land/visa costing; ticketing prepares airfare
        inputs for the proposal.
      </p>
    </>
  );
}

export function AssignJobCardCreatorFields({
  form,
  updateForm,
  queries,
  accountsTeamOptions,
}) {
  return (
    <>
      <Select
        label="Query"
        value={form.queryId}
        options={confirmedQueryOptions(queries)}
        onChange={(v) => updateForm("queryId", v)}
        required
      />
      <Select
        label="Job Card Creator"
        value={form.staffId}
        options={[
          { value: "", label: "Select Accounts member..." },
          ...accountsTeamOptions.map((o) => ({ value: o.value, label: o.label })),
        ]}
        onChange={(v) => updateForm("staffId", v)}
        required
      />
    </>
  );
}

export function AddProposalCollaboratorFields({ form, updateForm, proposals, team }) {
  return (
    <>
      <Select
        label="Proposal"
        value={form.proposalId || form.entityId}
        options={[
          { value: "", label: "Select proposal..." },
          ...proposals.map((p) => ({
            value: p.id,
            label: `${p.proposalCode} - ${p.clientName}`,
          })),
        ]}
        onChange={(v) => updateForm("proposalId", v)}
        required
      />
      <Select
        label="Collaborator"
        value={form.staffId}
        options={[
          { value: "", label: "Select team member..." },
          ...team.map((member) => ({ value: member.id, label: member.name })),
        ]}
        onChange={(v) => updateForm("staffId", v)}
        required
      />
    </>
  );
}

export function RemoveProposalCollaboratorFields({
  form,
  updateForm,
  proposals,
  proposalCollaboratorOptions,
  selectedProposalId,
}) {
  return (
    <>
      <Select
        label="Proposal"
        value={selectedProposalId}
        options={[
          { value: "", label: "Select proposal..." },
          ...proposals.map((p) => ({
            value: p.id,
            label: `${p.proposalCode} - ${p.clientName}`,
          })),
        ]}
        onChange={(v) => updateForm("proposalId", v)}
        required
      />
      <Select
        label="Collaborator"
        value={form.staffId}
        options={[
          { value: "", label: "Select collaborator..." },
          ...proposalCollaboratorOptions,
        ]}
        onChange={(v) => updateForm("staffId", v)}
        required
      />
    </>
  );
}

export function AddJobCardCollaboratorFields({
  form,
  updateForm,
  jobCards,
  team,
  handleJobCardSelect,
}) {
  return (
    <>
      <Select
        label="Job Card"
        value={form.jobCardId || form.entityId}
        options={jobCardSelectOptions(jobCards, { required: true })}
        onChange={handleJobCardSelect}
        required
      />
      <Select
        label="Collaborator"
        value={form.staffId}
        options={[
          { value: "", label: "Select team member..." },
          ...team.map((member) => ({ value: member.id, label: member.name })),
        ]}
        onChange={(v) => updateForm("staffId", v)}
        required
      />
    </>
  );
}

export function RemoveJobCardCollaboratorFields({
  form,
  updateForm,
  jobCards,
  jobCardCollaboratorOptions,
  selectedJobCardId,
  handleJobCardSelect,
}) {
  return (
    <>
      <Select
        label="Job Card"
        value={selectedJobCardId}
        options={jobCardSelectOptions(jobCards, { required: true })}
        onChange={handleJobCardSelect}
        required
      />
      <Select
        label="Collaborator"
        value={form.staffId}
        options={[
          { value: "", label: "Select collaborator..." },
          ...jobCardCollaboratorOptions,
        ]}
        onChange={(v) => updateForm("staffId", v)}
        required
      />
    </>
  );
}

export function AssignContractingOwnerFields({
  form,
  updateForm,
  jobCards,
  contractingTeamOptions,
  handleJobCardSelect,
}) {
  return (
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
  );
}

export function AssignOperationsOwnerFields({
  form,
  updateForm,
  jobCards,
  operationsTeamOptions,
  handleJobCardSelect,
}) {
  return (
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
  );
}

export function AssignTicketingOwnerFields({
  form,
  updateForm,
  access,
  jobCards,
  ticketingTeamOptions,
  handleJobCardSelect,
}) {
  return (
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
            className="portal-outline-btn mb-1 transition-transform duration-150 ease-out active:scale-[0.96]"
            onClick={() => updateForm("staffId", access.staffId)}
          >
            Assign to me
          </button>
        )}
      </div>
    </>
  );
}

export function teamOptionsForCollaborators(team, ids) {
  return teamOptionsForIds(team, ids);
}
