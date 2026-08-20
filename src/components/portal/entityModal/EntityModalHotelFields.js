"use client";

import { Input, Select, Textarea } from "@/components/portal/PortalModalForm";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";

export function EntityModalHotelFields({
  modal,
  form,
  updateForm,

  jobCards,

  handleJobCardSelect,
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
            formField="hotelName"
            label="Hotel Name"
            onChange={updateForm}
            required
            value={form.hotelName}
          />
          <Input formField="city" label="City" onChange={updateForm} value={form.city} />
          <Input
            formField="checkInDate"
            label="Check-in"
            onChange={updateForm}
            type="date"
            value={form.checkInDate}
          />
          <Input
            formField="checkOutDate"
            label="Check-out"
            onChange={updateForm}
            type="date"
            value={form.checkOutDate}
          />
          <Textarea
            formField="notes"
            label="Special Instructions"
            onChange={updateForm}
            value={form.notes}
          />
        </>
      )}
    </>
  );
}
