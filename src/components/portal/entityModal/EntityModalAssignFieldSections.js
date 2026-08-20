"use client";

import { Select } from "@/components/portal/PortalModalForm";
import { Button } from "@/components/ui/application-button";
import { TICKETING_SCOPE_OPTIONS } from "@/lib/portal/constants";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";
import {
  canAssignContracting,
  canAssignTicketing,
  canHeadAssignQueryTeams,
  usesSalesInitialAssignmentForm,
} from "@/lib/portal/permissions";

const TICKETING_SCOPE_SELECT_OPTIONS = [
  { label: "Select ticketing scope…", value: "" },
  ...TICKETING_SCOPE_OPTIONS.map((scope) => ({ label: scope, value: scope })),
];

function queryOptions(queries) {
  return queries.map((q) => ({
    label: `${q.queryCode} - ${q.clientName}`,
    value: q.id,
  }));
}

function confirmedQueryOptions(queries) {
  return queries.reduce((options, query) => {
    if (query.salesStatus === "Order Confirmed" || query.contractingStatus === "Order Confirmed") {
      options.push({
        label: `${query.queryCode} - ${query.clientName}`,
        value: query.id,
      });
    }
    return options;
  }, []);
}

function teamOptionsForIds(team, ids) {
  const idSet = new Set(ids ?? []);
  return team.reduce((options, member) => {
    if (idSet.has(member.id)) {
      options.push({ label: member.name, value: member.id });
    }
    return options;
  }, []);
}

export function AssignContractingFields({ form, updateForm, queries, contractingTeamOptions }) {
  return (
    <>
      <Select
        formField="queryId"
        label="Query"
        onChange={updateForm}
        options={queryOptions(queries)}
        required
        value={form.queryId}
      />
      <Select
        formField="staffId"
        label="Contracting SPOC"
        onChange={updateForm}
        options={[
          { label: "Select team member…", value: "" },
          ...contractingTeamOptions.map((o) => ({ label: o.label, value: o.value })),
        ]}
        required
        value={form.staffId}
      />
    </>
  );
}

export function AssignQueryTicketingFields({ form, updateForm, queries, ticketingTeamOptions }) {
  return (
    <>
      <Select
        formField="queryId"
        label="Query"
        onChange={updateForm}
        options={queryOptions(queries)}
        required
        value={form.queryId}
      />
      <Select
        formField="ticketingStaffId"
        label="Ticketing SPOC"
        onChange={updateForm}
        options={[
          { label: "Select team member…", value: "" },
          ...ticketingTeamOptions.map((o) => ({ label: o.label, value: o.value })),
        ]}
        required
        value={form.ticketingStaffId}
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
  const salesInitial = usesSalesInitialAssignmentForm(access);

  return (
    <>
      <Select
        formField="queryId"
        label="Query"
        onChange={updateForm}
        options={queryOptions(queries)}
        required
        value={form.queryId}
      />
      {(salesInitial || canAssignContracting(access)) && (
        <Select
          formField="staffId"
          label="Contracting SPOC"
          onChange={updateForm}
          options={[
            { label: "Select contracting…", value: "" },
            ...contractingTeamOptions.map((o) => ({
              label: o.label,
              value: o.value,
            })),
          ]}
          required={salesInitial}
          value={form.staffId}
        />
      )}
      {!salesInitial && canHeadAssignQueryTeams(access) && (
        <Select
          formField="ticketingStaffId"
          label="Ticketing SPOC"
          onChange={updateForm}
          options={[
            { label: "Select ticketing…", value: "" },
            ...ticketingTeamOptions.map((o) => ({
              label: o.label,
              value: o.value,
            })),
          ]}
          value={form.ticketingStaffId}
        />
      )}
      <Select
        formField="ticketingScope"
        label="Ticketing Scope"
        onChange={updateForm}
        options={TICKETING_SCOPE_SELECT_OPTIONS}
        required={salesInitial}
        value={form.ticketingScope}
      />
      <p className="text-brand-muted text-sm">
        {salesInitial
          ? "Choose the Contracting SPOC and Ticketing Scope. Ticketing heads will assign a Ticketing SPOC when needed."
          : "Assign at least one SPOC or update Ticketing Scope. Contracting prepares land/visa costing; ticketing prepares airfare inputs for the proposal."}
      </p>
    </>
  );
}

export function AssignJobCardCreatorFields({ form, updateForm, queries, accountsTeamOptions }) {
  return (
    <>
      <Select
        formField="queryId"
        label="Query"
        onChange={updateForm}
        options={confirmedQueryOptions(queries)}
        required
        value={form.queryId}
      />
      <Select
        formField="staffId"
        label="Job Card Creator"
        onChange={updateForm}
        options={[
          { label: "Select Accounts member...", value: "" },
          ...accountsTeamOptions.map((o) => ({ label: o.label, value: o.value })),
        ]}
        required
        value={form.staffId}
      />
    </>
  );
}

export function AddProposalCollaboratorFields({ form, updateForm, proposals, team }) {
  return (
    <>
      <Select
        formField="proposalId"
        label="Proposal"
        onChange={updateForm}
        options={[
          { label: "Select proposal...", value: "" },
          ...proposals.map((p) => ({
            label: `${p.proposalCode} - ${p.clientName}`,
            value: p.id,
          })),
        ]}
        required
        value={form.proposalId || form.entityId}
      />
      <Select
        formField="staffId"
        label="Collaborator"
        onChange={updateForm}
        options={[
          { label: "Select team member...", value: "" },
          ...team.map((member) => ({ label: member.name, value: member.id })),
        ]}
        required
        value={form.staffId}
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
        formField="proposalId"
        label="Proposal"
        onChange={updateForm}
        options={[
          { label: "Select proposal...", value: "" },
          ...proposals.map((p) => ({
            label: `${p.proposalCode} - ${p.clientName}`,
            value: p.id,
          })),
        ]}
        required
        value={selectedProposalId}
      />
      <Select
        formField="staffId"
        label="Collaborator"
        onChange={updateForm}
        options={[{ label: "Select collaborator...", value: "" }, ...proposalCollaboratorOptions]}
        required
        value={form.staffId}
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
        onChange={handleJobCardSelect}
        options={jobCardSelectOptions(jobCards, { required: true })}
        required
        value={form.jobCardId || form.entityId}
      />
      <Select
        formField="staffId"
        label="Collaborator"
        onChange={updateForm}
        options={[
          { label: "Select team member...", value: "" },
          ...team.map((member) => ({ label: member.name, value: member.id })),
        ]}
        required
        value={form.staffId}
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
        onChange={handleJobCardSelect}
        options={jobCardSelectOptions(jobCards, { required: true })}
        required
        value={selectedJobCardId}
      />
      <Select
        formField="staffId"
        label="Collaborator"
        onChange={updateForm}
        options={[{ label: "Select collaborator...", value: "" }, ...jobCardCollaboratorOptions]}
        required
        value={form.staffId}
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
        onChange={handleJobCardSelect}
        options={jobCardSelectOptions(jobCards, { required: true })}
        required
        value={form.jobCardId}
      />
      <Select
        formField="staffId"
        label="Contracting SPOC"
        onChange={updateForm}
        options={[
          { label: "Select team member…", value: "" },
          ...contractingTeamOptions.map((o) => ({ label: o.label, value: o.value })),
        ]}
        required
        value={form.staffId}
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
        onChange={handleJobCardSelect}
        options={jobCardSelectOptions(jobCards, { required: true })}
        required
        value={form.jobCardId}
      />
      <Select
        formField="staffId"
        label="Operations SPOC"
        onChange={updateForm}
        options={[
          { label: "Select team member…", value: "" },
          ...operationsTeamOptions.map((o) => ({ label: o.label, value: o.value })),
        ]}
        required
        value={form.staffId}
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
  const handleAssignToMe = () => {
    updateForm("staffId", access.staffId);
  };
  return (
    <>
      <Select
        label="Job Card"
        onChange={handleJobCardSelect}
        options={jobCardSelectOptions(jobCards, { required: true })}
        required
        value={form.jobCardId}
      />
      <div className="flex flex-wrap items-end gap-3 md:col-span-2">
        <div className="min-w-[240px] flex-1">
          <Select
            formField="staffId"
            label="Ticketing SPOC"
            onChange={updateForm}
            options={[
              { label: "Select team member…", value: "" },
              ...ticketingTeamOptions.map((o) => ({
                label: o.label,
                value: o.value,
              })),
            ]}
            required
            value={form.staffId}
          />
        </div>
        {canAssignTicketing(access) && access?.staffId && (
          <Button
            className="portal-outline-btn mb-1 transition-transform duration-150 ease-out active:scale-[0.96]"
            onClick={handleAssignToMe}
            type="button"
          >
            Assign to me
          </Button>
        )}
      </div>
    </>
  );
}

export function teamOptionsForCollaborators(team, ids) {
  return teamOptionsForIds(team, ids);
}
