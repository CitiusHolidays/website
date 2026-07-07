"use client";

import { Input, Select, Textarea } from "@/components/portal/PortalModalForm";
import { VISA_STATUSES } from "@/lib/portal/constants";

export function EntityModalVisaFields({
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
            label="Visa Status"
            onChange={(v) => updateForm("visaStatus", v)}
            options={VISA_STATUSES}
            value={form.visaStatus}
          />
          <Input
            label="Appointment Date"
            onChange={(v) => updateForm("appointmentDate", v)}
            type="date"
            value={form.appointmentDate}
          />
          <Textarea label="Notes" onChange={(v) => updateForm("notes", v)} value={form.notes} />
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
            label="Visa Status"
            onChange={(v) => updateForm("visaStatus", v)}
            options={VISA_STATUSES}
            value={form.visaStatus}
          />
        </>
      )}
    </>
  );
}
