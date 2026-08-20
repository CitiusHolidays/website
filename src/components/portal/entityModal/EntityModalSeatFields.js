"use client";

import { Input, Select, Textarea } from "@/components/portal/PortalModalForm";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";

export function EntityModalSeatFields({
  modal,
  form,
  updateForm,

  jobCards,

  travellerOptions,
  pnrOptions,

  handleJobCardSelect,
  handleTravellerSelect,
  handlePnrSelect,
}) {
  return (
    <>
      {modal === "seat" && (
        <>
          <Select
            label="Job Card"
            onChange={handleJobCardSelect}
            options={jobCardSelectOptions(jobCards, { required: true })}
            required
            value={form.jobCardId}
          />
          <Select
            label="Traveller"
            onChange={handleTravellerSelect}
            options={travellerOptions}
            value={form.travellerId}
          />
          <Select label="PNR" onChange={handlePnrSelect} options={pnrOptions} value={form.pnrId} />
          <Input
            formField="seatNumber"
            label="Seat Number"
            onChange={updateForm}
            required
            value={form.seatNumber}
          />
          <Select
            formField="seatStatus"
            label="Status"
            onChange={updateForm}
            options={["Available", "Held", "Assigned", "Blocked"]}
            value={form.seatStatus}
          />
          <Textarea formField="notes" label="Notes" onChange={updateForm} value={form.notes} />
        </>
      )}
    </>
  );
}
