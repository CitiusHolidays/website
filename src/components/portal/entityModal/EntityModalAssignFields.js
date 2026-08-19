"use client";

import {
  AddJobCardCollaboratorFields,
  AddProposalCollaboratorFields,
  AssignContractingFields,
  AssignContractingOwnerFields,
  AssignJobCardCreatorFields,
  AssignOperationsOwnerFields,
  AssignQueryTeamsFields,
  AssignQueryTicketingFields,
  AssignTicketingOwnerFields,
  RemoveJobCardCollaboratorFields,
  RemoveProposalCollaboratorFields,
  teamOptionsForCollaborators,
} from "./EntityModalAssignFieldSections";

export function EntityModalAssignFields({
  modal,
  form,
  updateForm,
  access,
  queries,
  proposals,
  jobCards,
  team,
  contractingTeamOptions,
  operationsTeamOptions,
  accountsTeamOptions,
  ticketingTeamOptions,
  handleJobCardSelect,
}) {
  const selectedProposalId = form.proposalId || form.entityId;
  const selectedProposal = proposals.find((proposal) => proposal.id === selectedProposalId);
  const proposalCollaboratorOptions = teamOptionsForCollaborators(
    team,
    selectedProposal?.collaboratorStaffIds
  );
  const selectedJobCardId = form.jobCardId || form.entityId;
  const selectedJobCard = jobCards.find((jobCard) => jobCard.id === selectedJobCardId);
  const jobCardCollaboratorOptions = teamOptionsForCollaborators(
    team,
    selectedJobCard?.collaboratorStaffIds
  );

  const fieldsByModal = new Map([
    [
      "assignContracting",
      <AssignContractingFields
        contractingTeamOptions={contractingTeamOptions}
        form={form}
        queries={queries}
        updateForm={updateForm}
      />,
    ],
    [
      "assignQueryTicketing",
      <AssignQueryTicketingFields
        form={form}
        queries={queries}
        ticketingTeamOptions={ticketingTeamOptions}
        updateForm={updateForm}
      />,
    ],
    [
      "assignQueryTeams",
      <AssignQueryTeamsFields
        access={access}
        contractingTeamOptions={contractingTeamOptions}
        form={form}
        queries={queries}
        ticketingTeamOptions={ticketingTeamOptions}
        updateForm={updateForm}
      />,
    ],
    [
      "assignJobCardCreator",
      <AssignJobCardCreatorFields
        accountsTeamOptions={accountsTeamOptions}
        form={form}
        queries={queries}
        updateForm={updateForm}
      />,
    ],
    [
      "addProposalCollaborator",
      <AddProposalCollaboratorFields
        form={form}
        proposals={proposals}
        team={team}
        updateForm={updateForm}
      />,
    ],
    [
      "removeProposalCollaborator",
      <RemoveProposalCollaboratorFields
        form={form}
        proposalCollaboratorOptions={proposalCollaboratorOptions}
        proposals={proposals}
        selectedProposalId={selectedProposalId}
        updateForm={updateForm}
      />,
    ],
    [
      "addJobCardCollaborator",
      <AddJobCardCollaboratorFields
        form={form}
        handleJobCardSelect={handleJobCardSelect}
        jobCards={jobCards}
        team={team}
        updateForm={updateForm}
      />,
    ],
    [
      "removeJobCardCollaborator",
      <RemoveJobCardCollaboratorFields
        form={form}
        handleJobCardSelect={handleJobCardSelect}
        jobCardCollaboratorOptions={jobCardCollaboratorOptions}
        jobCards={jobCards}
        selectedJobCardId={selectedJobCardId}
        updateForm={updateForm}
      />,
    ],
    [
      "assignContractingOwner",
      <AssignContractingOwnerFields
        contractingTeamOptions={contractingTeamOptions}
        form={form}
        handleJobCardSelect={handleJobCardSelect}
        jobCards={jobCards}
        updateForm={updateForm}
      />,
    ],
    [
      "assignOperationsOwner",
      <AssignOperationsOwnerFields
        form={form}
        handleJobCardSelect={handleJobCardSelect}
        jobCards={jobCards}
        operationsTeamOptions={operationsTeamOptions}
        updateForm={updateForm}
      />,
    ],
    [
      "assignTicketingOwner",
      <AssignTicketingOwnerFields
        access={access}
        form={form}
        handleJobCardSelect={handleJobCardSelect}
        jobCards={jobCards}
        ticketingTeamOptions={ticketingTeamOptions}
        updateForm={updateForm}
      />,
    ],
  ]);

  return fieldsByModal.get(modal) ?? null;
}
