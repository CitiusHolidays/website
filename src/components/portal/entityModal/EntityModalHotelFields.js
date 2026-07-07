"use client";

import { Input, Select, Textarea } from "@/components/portal/PortalModalForm";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";

export function EntityModalHotelFields({
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
      {modal === "hotel" && (
        <>
          <Select
            label="Job Card"
            onChange={handleJobCardSelect}
            options={jobCardSelectOptions(jobCards, { required: true })}
            required
            value={form.jobCardId}
          />
          <Input
            label="Hotel Name"
            onChange={(v) => updateForm("hotelName", v)}
            required
            value={form.hotelName}
          />
          <Input label="City" onChange={(v) => updateForm("city", v)} value={form.city} />
          <Input
            label="Check-in"
            onChange={(v) => updateForm("checkInDate", v)}
            type="date"
            value={form.checkInDate}
          />
          <Input
            label="Check-out"
            onChange={(v) => updateForm("checkOutDate", v)}
            type="date"
            value={form.checkOutDate}
          />
          <Textarea
            label="Special Instructions"
            onChange={(v) => updateForm("notes", v)}
            value={form.notes}
          />
        </>
      )}
    </>
  );
}
