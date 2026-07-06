"use client";

import { EntityModalShell } from "@/components/portal/entityModal/EntityModalShell";
import { getEntityModalTitle } from "@/components/portal/entityModal/entityModalTitles";
import { useEntityModalLinking } from "@/components/portal/entityModal/useEntityModalLinking";
import { linkedPnrOptions, linkedTravellerOptions } from "@/lib/portal/entityModalLinks";
import { calculateLeaveRequestImpact } from "@/lib/portal/leavePolicy";
import { teamSelectOptions } from "@/lib/portal/permissions";
import { CONTRACTING_TEAM_ROLES, SALES_REP_ROLES, TICKETING_TEAM_ROLES } from "@/lib/portal/constants";

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
    { value: "", label: "Use leave matrix default" },
    ...leaveHeadApproverCandidates.map((member) => ({
      value: member.id,
      label: member.label,
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
          leaveType: form.leaveType,
          startDate: form.startDate,
          endDate: form.endDate,
          employmentStatus: selectedLeaveStaff.employmentStatus || "Confirmed",
          joiningDate: selectedLeaveStaff.joiningDate || "",
          balances: leaveBalanceMap,
        })
      : null;

  const linking = useEntityModalLinking({
    modal,
    form,
    updateForm,
    patchForm,
    queries,
    proposals,
    jobCards,
    travellers,
    travellersWithoutVisa,
    pnrs,
    visas,
    team,
  });

  const title = getEntityModalTitle(modal, form, has, access);
  const lifecycleQuery = queries?.find((entry) => entry.id === (form.entityId || form.queryId));
  const lifecycleProposal = proposals?.find((entry) => entry.id === form.entityId);
  const lifecycleJobCard = jobCards?.find((entry) => entry.id === form.entityId);

  const primaryProps = {
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
    accountsTeamOptions,
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
    ...linking,
  };

  const secondaryProps = {
    modal,
    form,
    updateForm,
    patchForm,
    has,
    access,
    jobCards,
    travellers,
    visas,
    pnrs,
    team,
    travellersWithoutVisa,
    travellerOptions,
    pnrOptions,
    tourManagerOptions,
    leaveHeadApproverOptions,
    leaveImpact,
    leaveBalanceRows,
    pendingExpenseProofFiles,
    setPendingExpenseProofFiles,
    handleJobCardSelect: linking.handleJobCardSelect,
    handleTravellerSelect: linking.handleTravellerSelect,
    handlePnrSelect: linking.handlePnrSelect,
    handleVisaRecordSelect: linking.handleVisaRecordSelect,
    handleStaffSelect: linking.handleStaffSelect,
  };

  return (
    <EntityModalShell
      modal={modal}
      form={form}
      updateForm={updateForm}
      patchForm={patchForm}
      submit={submit}
      close={close}
      error={error}
      isSaving={isSaving}
      title={title}
      lifecycleQuery={lifecycleQuery}
      lifecycleProposal={lifecycleProposal}
      lifecycleJobCard={lifecycleJobCard}
      has={has}
      primaryProps={primaryProps}
      secondaryProps={secondaryProps}
    />
  );
}
