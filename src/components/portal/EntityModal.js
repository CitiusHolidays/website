"use client";

import { EntityModalShell } from "@/components/portal/entityModal/EntityModalShell";
import { getEntityModalTitle } from "@/components/portal/entityModal/entityModalTitles";
import { useEntityModalLinking } from "@/components/portal/entityModal/useEntityModalLinking";
import { CONTRACTING_TEAM_ROLES, TICKETING_TEAM_ROLES } from "@/lib/portal/constants";
import { linkedPnrOptions, linkedTravellerOptions } from "@/lib/portal/entityModalLinks";
import { calculateLeaveRequestImpact } from "@/lib/portal/leavePolicy";
import { teamSelectOptions } from "@/lib/portal/permissions";

const EMPTY_ARRAY = [];

export function EntityModal({
  modal,
  form,
  updateForm,
  patchForm,
  submit,
  close,
  error,
  isSaving,
  queries,
  proposals,
  jobCards,
  travellers,
  visas,
  pnrs,
  team,
  leaveBalances,
  travellersWithoutVisa,
  pendingQueryFiles,
  setPendingQueryFiles,
  pendingProposalFiles,
  setPendingProposalFiles,
  pendingExpenseProofFiles,
  setPendingExpenseProofFiles,
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
  getExpenseAttachmentUrl,
  removeExpenseProof,
  has,
  access,
  leaveHeadApproverCandidates = EMPTY_ARRAY,
}) {
  const leaveHeadApproverOptions = [
    { label: "Use leave matrix default", value: "" },
    ...leaveHeadApproverCandidates.map((member) => ({
      label: member.label,
      value: member.id,
    })),
  ];
  const contractingTeamOptions = teamSelectOptions(team, CONTRACTING_TEAM_ROLES);
  const operationsTeamOptions = teamSelectOptions(team, [
    "Operations",
    "Operations Head",
    "Operations Cement",
  ]);
  const accountsTeamOptions = teamSelectOptions(team, ["Accounts", "Accounts Head"]);
  const ticketingTeamOptions = teamSelectOptions(team, TICKETING_TEAM_ROLES);
  const tourManagerOptions = teamSelectOptions(team, ["Tour Manager"]);
  const travellerOptions = linkedTravellerOptions(travellers, form.jobCardId);
  const pnrOptions = linkedPnrOptions(pnrs, form.jobCardId);
  const selectedLeaveStaff =
    team.find((member) => member.id === form.staffId) ||
    team.find((member) => member.id === access?.staffId) ||
    {};
  const leaveBalanceEntries = [];
  const leaveBalanceRows = Array.isArray(leaveBalances) ? [] : null;
  for (const row of leaveBalances || []) {
    if (!form.staffId || row.staffId === form.staffId) {
      leaveBalanceEntries.push([row.leaveType, row.availableDays]);
      leaveBalanceRows?.push(row);
    }
  }
  const leaveBalanceMap = Object.fromEntries(leaveBalanceEntries);
  const leaveImpact =
    modal === "leave_create" && form.startDate && form.endDate
      ? calculateLeaveRequestImpact({
          balances: leaveBalanceMap,
          employmentStatus: selectedLeaveStaff.employmentStatus || "Confirmed",
          endDate: form.endDate,
          joiningDate: selectedLeaveStaff.joiningDate || "",
          leaveType: form.leaveType,
          startDate: form.startDate,
        })
      : null;

  const linking = useEntityModalLinking({
    form,
    jobCards,
    modal,
    patchForm,
    pnrs,
    proposals,
    queries,
    team,
    travellers,
    travellersWithoutVisa,
    updateForm,
    visas,
  });

  const title = getEntityModalTitle(modal, form, has, access);
  const lifecycleQuery = queries?.find((entry) => entry.id === (form.entityId || form.queryId));
  const lifecycleProposal = proposals?.find((entry) => entry.id === form.entityId);
  const lifecycleJobCard = jobCards?.find((entry) => entry.id === form.entityId);

  const primaryProps = {
    access,
    accountsTeamOptions,
    attachFinalizedPdf,
    attachProposalFile,
    attachQueryFile,
    contractingTeamOptions,
    form,
    generateFinalizedPdfUploadUrl,
    generateProposalUploadUrl,
    generateQueryUploadUrl,
    getFinalizedPdfUrl,
    getProposalAttachmentUrl,
    getQueryAttachmentUrl,
    has,
    jobCards,
    modal,
    operationsTeamOptions,
    patchForm,
    pendingProposalFiles,
    pendingQueryFiles,
    proposals,
    queries,
    removeFinalizedPdf,
    removeProposalAttachment,
    removeQueryAttachment,
    setPendingProposalFiles,
    setPendingQueryFiles,
    team,
    ticketingTeamOptions,
    updateForm,
    ...linking,
  };

  const secondaryProps = {
    access,
    form,
    handleJobCardSelect: linking.handleJobCardSelect,
    handlePnrSelect: linking.handlePnrSelect,
    handleStaffSelect: linking.handleStaffSelect,
    handleTravellerSelect: linking.handleTravellerSelect,
    handleVisaRecordSelect: linking.handleVisaRecordSelect,
    has,
    jobCards,
    leaveBalanceRows,
    leaveHeadApproverOptions,
    leaveImpact,
    modal,
    patchForm,
    pendingExpenseProofFiles,
    pnrOptions,
    pnrs,
    setPendingExpenseProofFiles,
    team,
    tourManagerOptions,
    travellerOptions,
    travellers,
    travellersWithoutVisa,
    updateForm,
    visas,
  };

  return (
    <EntityModalShell
      close={close}
      error={error}
      form={form}
      has={has}
      isSaving={isSaving}
      lifecycleJobCard={lifecycleJobCard}
      lifecycleProposal={lifecycleProposal}
      lifecycleQuery={lifecycleQuery}
      modal={modal}
      patchForm={patchForm}
      primaryProps={primaryProps}
      secondaryProps={secondaryProps}
      submit={submit}
      title={title}
      updateForm={updateForm}
    />
  );
}
