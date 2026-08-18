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
            label="Seat Number"
            onChange={(v) => updateForm("seatNumber", v)}
            required
            value={form.seatNumber}
          />
          <Select
            label="Status"
            onChange={(v) => updateForm("seatStatus", v)}
            options={["Available", "Held", "Assigned", "Blocked"]}
            value={form.seatStatus}
          />
          <Textarea label="Notes" onChange={(v) => updateForm("notes", v)} value={form.notes} />
        </>
      )}
    </>
  );
}
