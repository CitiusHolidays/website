"use client";

import { Input, Select, Textarea } from "@/components/portal/PortalModalForm";
import { jobCardSelectOptions, travelBatchSelectOptions } from "@/lib/portal/entityModalLinks";

export function EntityModalTourManagerFields({
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
      {modal === "tourManager" && (
        <>
          <Select
            label="Job Card"
            onChange={handleJobCardSelect}
            options={jobCardSelectOptions(jobCards, { required: true })}
            required
            value={form.jobCardId}
          />
          {form.jobCardId ? (
            <Select
              label="Travel Batch"
              onChange={(value) => updateForm("travelBatchId", value)}
              options={travelBatchSelectOptions(jobCards, form.jobCardId)}
              value={form.travelBatchId || ""}
            />
          ) : null}
          <Select
            label="Tour Manager"
            onChange={(v) => handleStaffSelect("staffId", v)}
            options={[
              { label: "Select tour manager…", value: "" },
              ...tourManagerOptions.map((o) => ({ label: o.label, value: o.value })),
            ]}
            required
            value={form.staffId}
          />
          <Input
            label="Email"
            onChange={(v) => updateForm("staffEmail", v)}
            value={form.staffEmail}
          />
          <Input label="Phone" onChange={(v) => updateForm("paidBy", v)} value={form.paidBy} />
          <Input
            label="Available Date"
            onChange={(v) => updateForm("travelStartDate", v)}
            type="date"
            value={form.travelStartDate}
          />
          <Textarea
            label="Reporting Instructions"
            onChange={(v) => updateForm("reportingInstructions", v)}
            value={form.reportingInstructions || ""}
          />
          <Textarea label="Notes" onChange={(v) => updateForm("notes", v)} value={form.notes} />
        </>
      )}
    </>
  );
}
