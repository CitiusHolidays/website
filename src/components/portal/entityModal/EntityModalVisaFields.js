"use client";

import { Input, Select, Textarea } from "@/components/portal/PortalModalForm";
import { VISA_STATUSES } from "@/lib/portal/constants";

export function EntityModalVisaFields({
  modal,
  form,
  updateForm,

  visas,

  travellersWithoutVisa,

  handleTravellerSelect,

  handleVisaRecordSelect,
}) {
  return (
    <>
      {modal === "visa" && (
        <>
          <Select
            label="Visa Record"
            onChange={handleVisaRecordSelect}
            options={visas.map((v) => ({
              label: `${v.travellerName} - ${v.jobCode}`,
              value: v.id,
            }))}
            required
            value={form.visaRecordId}
          />
          <Select
            formField="visaStatus"
            label="Visa Status"
            onChange={updateForm}
            options={VISA_STATUSES}
            value={form.visaStatus}
          />
          <Input
            formField="appointmentDate"
            label="Appointment Date"
            onChange={updateForm}
            type="date"
            value={form.appointmentDate}
          />
          <Textarea formField="notes" label="Notes" onChange={updateForm} value={form.notes} />
        </>
      )}
      {modal === "visa_create" && (
        <>
          <Select
            label="Traveller"
            onChange={handleTravellerSelect}
            options={[
              { label: "Select Traveller", value: "" },
              ...travellersWithoutVisa.map((t) => ({
                label: `${t.fullName} (${t.jobCode} - ${t.clientName})`,
                value: t.id,
              })),
            ]}
            required
            value={form.travellerId}
          />
          <Select
            formField="visaStatus"
            label="Visa Status"
            onChange={updateForm}
            options={VISA_STATUSES}
            value={form.visaStatus}
          />
        </>
      )}
    </>
  );
}
