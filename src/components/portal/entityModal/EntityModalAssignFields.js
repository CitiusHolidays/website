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

  switch (modal) {
    case "assignContracting":
      return (
        <AssignContractingFields
          contractingTeamOptions={contractingTeamOptions}
          form={form}
          queries={queries}
          updateForm={updateForm}
        />
      );
    case "assignQueryTicketing":
      return (
        <AssignQueryTicketingFields
          form={form}
          queries={queries}
          ticketingTeamOptions={ticketingTeamOptions}
          updateForm={updateForm}
        />
      );
    case "assignQueryTeams":
      return (
        <AssignQueryTeamsFields
          access={access}
          contractingTeamOptions={contractingTeamOptions}
          form={form}
          queries={queries}
          ticketingTeamOptions={ticketingTeamOptions}
          updateForm={updateForm}
        />
      );
    case "assignJobCardCreator":
      return (
        <AssignJobCardCreatorFields
          accountsTeamOptions={accountsTeamOptions}
          form={form}
          queries={queries}
          updateForm={updateForm}
        />
      );
    case "addProposalCollaborator":
      return (
        <AddProposalCollaboratorFields
          form={form}
          proposals={proposals}
          team={team}
          updateForm={updateForm}
        />
      );
    case "removeProposalCollaborator":
      return (
        <RemoveProposalCollaboratorFields
          form={form}
          proposalCollaboratorOptions={proposalCollaboratorOptions}
          proposals={proposals}
          selectedProposalId={selectedProposalId}
          updateForm={updateForm}
        />
      );
    case "addJobCardCollaborator":
      return (
        <AddJobCardCollaboratorFields
          form={form}
          handleJobCardSelect={handleJobCardSelect}
          jobCards={jobCards}
          team={team}
          updateForm={updateForm}
        />
      );
    case "removeJobCardCollaborator":
      return (
        <RemoveJobCardCollaboratorFields
          form={form}
          handleJobCardSelect={handleJobCardSelect}
          jobCardCollaboratorOptions={jobCardCollaboratorOptions}
          jobCards={jobCards}
          selectedJobCardId={selectedJobCardId}
          updateForm={updateForm}
        />
      );
    case "assignContractingOwner":
      return (
        <AssignContractingOwnerFields
          contractingTeamOptions={contractingTeamOptions}
          form={form}
          handleJobCardSelect={handleJobCardSelect}
          jobCards={jobCards}
          updateForm={updateForm}
        />
      );
    case "assignOperationsOwner":
      return (
        <AssignOperationsOwnerFields
          form={form}
          handleJobCardSelect={handleJobCardSelect}
          jobCards={jobCards}
          operationsTeamOptions={operationsTeamOptions}
          updateForm={updateForm}
        />
      );
    case "assignTicketingOwner":
      return (
        <AssignTicketingOwnerFields
          access={access}
          form={form}
          handleJobCardSelect={handleJobCardSelect}
          jobCards={jobCards}
          ticketingTeamOptions={ticketingTeamOptions}
          updateForm={updateForm}
        />
      );
    default:
      return null;
  }
}
