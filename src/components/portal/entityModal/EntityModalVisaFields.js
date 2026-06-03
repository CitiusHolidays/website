"use client";

import {
  Input,
  MultiSelect,
  money,
  QueryFilePicker,
  Select,
  Textarea,
} from "@/components/portal/PortalModalForm";
import {
  CABIN_CLASSES,
  EXPENSE_CURRENCIES,
  EXPENSE_HEADS,
  FOOD_PREFERENCES,
  GUEST_TYPES,
  LEAVE_TYPES,
  PAYMENT_TYPES,
  PORTAL_ROLES,
  TICKET_STATUSES,
  TICKET_TYPES,
  VISA_STATUSES,
} from "@/lib/portal/constants";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";
import { getExpenseSplitTotal } from "@/lib/portal/workflow";

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
            value={form.visaRecordId}
            options={visas.map((v) => ({
              value: v.id,
              label: `${v.travellerName} - ${v.jobCode}`,
            }))}
            onChange={handleVisaRecordSelect}
            required
          />
          <Select
            label="Visa Status"
            value={form.visaStatus}
            options={VISA_STATUSES}
            onChange={(v) => updateForm("visaStatus", v)}
          />
          <Input
            label="Appointment Date"
            type="date"
            value={form.appointmentDate}
            onChange={(v) => updateForm("appointmentDate", v)}
          />
          <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} />
        </>
      )}
      {modal === "visa_create" && (
        <>
          <Select
            label="Traveller"
            value={form.travellerId}
            options={[
              { value: "", label: "Select Traveller" },
              ...travellersWithoutVisa.map((t) => ({
                value: t.id,
                label: `${t.fullName} (${t.jobCode} - ${t.clientName})`,
              })),
            ]}
            onChange={handleTravellerSelect}
            required
          />
          <Select
            label="Visa Status"
            value={form.visaStatus}
            options={VISA_STATUSES}
            onChange={(v) => updateForm("visaStatus", v)}
          />
        </>
      )}
    </>
  );
}
