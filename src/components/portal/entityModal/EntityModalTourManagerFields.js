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
            value={form.jobCardId}
            options={jobCardSelectOptions(jobCards, { allowUnassigned: true })}
            onChange={handleJobCardSelect}
          />
          <Select
            label="Tour Manager"
            value={form.staffId}
            options={[
              { value: "", label: "Select tour manager…" },
              ...tourManagerOptions.map((o) => ({ value: o.value, label: o.label })),
            ]}
            onChange={(v) => handleStaffSelect("staffId", v)}
            required
          />
          <Input
            label="Email"
            value={form.staffEmail}
            onChange={(v) => updateForm("staffEmail", v)}
          />
          <Input label="Phone" value={form.paidBy} onChange={(v) => updateForm("paidBy", v)} />
          <Input
            label="Available Date"
            type="date"
            value={form.travelStartDate}
            onChange={(v) => updateForm("travelStartDate", v)}
          />
          <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} />
        </>
      )}
    </>
  );
}
