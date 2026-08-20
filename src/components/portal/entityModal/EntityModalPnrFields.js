"use client";

import { Input, Select } from "@/components/portal/PortalModalForm";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";

export function EntityModalPnrFields({
  modal,
  form,
  updateForm,

  jobCards,

  handleJobCardSelect,
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
            formField="pnrCode"
            label="PNR"
            onChange={updateForm}
            required
            value={form.pnrCode}
          />
          <Input formField="airline" label="Airline" onChange={updateForm} value={form.airline} />
          <Input formField="route" label="Route" onChange={updateForm} value={form.route} />
          <Input
            formField="fareType"
            label="Fare Type"
            onChange={updateForm}
            value={form.fareType}
          />
          <Input
            formField="totalSeats"
            label="Total Seats"
            onChange={updateForm}
            type="number"
            value={form.totalSeats}
          />
        </>
      )}
    </>
  );
}
