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
            value={form.jobCardId}
            options={jobCardSelectOptions(jobCards, { required: true })}
            onChange={handleJobCardSelect}
            required
          />
          <Input
            label="PNR"
            value={form.pnrCode}
            onChange={(v) => updateForm("pnrCode", v)}
            required
          />
          <Input label="Airline" value={form.airline} onChange={(v) => updateForm("airline", v)} />
          <Input label="Route" value={form.route} onChange={(v) => updateForm("route", v)} />
          <Input
            label="Fare Type"
            value={form.fareType}
            onChange={(v) => updateForm("fareType", v)}
          />
          <Input
            label="Total Seats"
            type="number"
            value={form.totalSeats}
            onChange={(v) => updateForm("totalSeats", v)}
          />
        </>
      )}
    </>
  );
}
