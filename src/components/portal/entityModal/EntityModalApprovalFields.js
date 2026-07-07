"use client";

import { Textarea } from "@/components/portal/PortalModalForm";

export function EntityModalApprovalFields({
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
  pendingExpenseProofFiles,
  setPendingExpenseProofFiles,
  handleJobCardSelect,
  handleTravellerSelect,
  handlePnrSelect,
  handleVisaRecordSelect,
  handleStaffSelect,
}) {
  return (
    <>
      {modal === "approvalDecide" && (
        <>
          <Textarea
            label="Decision Note"
            onChange={(v) => updateForm("decisionNote", v)}
            placeholder="Explain what details are needed or why this is rejected"
            required
            value={form.decisionNote}
          />
        </>
      )}
    </>
  );
}
