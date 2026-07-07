"use client";

import { Input, Select } from "@/components/portal/PortalModalForm";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";

export function EntityModalPnrFields({
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
      {modal === "pnr" && (
        <>
          <Select
            label="Job Card"
            onChange={handleJobCardSelect}
            options={jobCardSelectOptions(jobCards, { required: true })}
            required
            value={form.jobCardId}
          />
          <Input
            label="PNR"
            onChange={(v) => updateForm("pnrCode", v)}
            required
            value={form.pnrCode}
          />
          <Input label="Airline" onChange={(v) => updateForm("airline", v)} value={form.airline} />
          <Input label="Route" onChange={(v) => updateForm("route", v)} value={form.route} />
          <Input
            label="Fare Type"
            onChange={(v) => updateForm("fareType", v)}
            value={form.fareType}
          />
          <Input
            label="Total Seats"
            onChange={(v) => updateForm("totalSeats", v)}
            type="number"
            value={form.totalSeats}
          />
        </>
      )}
    </>
  );
}
