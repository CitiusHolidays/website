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
    selectedProposal?.collaboratorStaffIds,
  );
  const selectedJobCardId = form.jobCardId || form.entityId;
  const selectedJobCard = jobCards.find((jobCard) => jobCard.id === selectedJobCardId);
  const jobCardCollaboratorOptions = teamOptionsForCollaborators(
    team,
    selectedJobCard?.collaboratorStaffIds,
  );

  switch (modal) {
    case "assignContracting":
      return (
        <AssignContractingFields
          form={form}
          updateForm={updateForm}
          queries={queries}
          contractingTeamOptions={contractingTeamOptions}
        />
      );
    case "assignQueryTicketing":
      return (
        <AssignQueryTicketingFields
          form={form}
          updateForm={updateForm}
          queries={queries}
          ticketingTeamOptions={ticketingTeamOptions}
        />
      );
    case "assignQueryTeams":
      return (
        <AssignQueryTeamsFields
          form={form}
          updateForm={updateForm}
          access={access}
          queries={queries}
          contractingTeamOptions={contractingTeamOptions}
          ticketingTeamOptions={ticketingTeamOptions}
        />
      );
    case "assignJobCardCreator":
      return (
        <AssignJobCardCreatorFields
          form={form}
          updateForm={updateForm}
          queries={queries}
          accountsTeamOptions={accountsTeamOptions}
        />
      );
    case "addProposalCollaborator":
      return (
        <AddProposalCollaboratorFields
          form={form}
          updateForm={updateForm}
          proposals={proposals}
          team={team}
        />
      );
    case "removeProposalCollaborator":
      return (
        <RemoveProposalCollaboratorFields
          form={form}
          updateForm={updateForm}
          proposals={proposals}
          proposalCollaboratorOptions={proposalCollaboratorOptions}
          selectedProposalId={selectedProposalId}
        />
      );
    case "addJobCardCollaborator":
      return (
        <AddJobCardCollaboratorFields
          form={form}
          updateForm={updateForm}
          jobCards={jobCards}
          team={team}
          handleJobCardSelect={handleJobCardSelect}
        />
      );
    case "removeJobCardCollaborator":
      return (
        <RemoveJobCardCollaboratorFields
          form={form}
          updateForm={updateForm}
          jobCards={jobCards}
          jobCardCollaboratorOptions={jobCardCollaboratorOptions}
          selectedJobCardId={selectedJobCardId}
          handleJobCardSelect={handleJobCardSelect}
        />
      );
    case "assignContractingOwner":
      return (
        <AssignContractingOwnerFields
          form={form}
          updateForm={updateForm}
          jobCards={jobCards}
          contractingTeamOptions={contractingTeamOptions}
          handleJobCardSelect={handleJobCardSelect}
        />
      );
    case "assignOperationsOwner":
      return (
        <AssignOperationsOwnerFields
          form={form}
          updateForm={updateForm}
          jobCards={jobCards}
          operationsTeamOptions={operationsTeamOptions}
          handleJobCardSelect={handleJobCardSelect}
        />
      );
    case "assignTicketingOwner":
      return (
        <AssignTicketingOwnerFields
          form={form}
          updateForm={updateForm}
          access={access}
          jobCards={jobCards}
          ticketingTeamOptions={ticketingTeamOptions}
          handleJobCardSelect={handleJobCardSelect}
        />
      );
    default:
      return null;
  }
}
