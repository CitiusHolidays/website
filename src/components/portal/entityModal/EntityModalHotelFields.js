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
            value={form.jobCardId}
            options={jobCardSelectOptions(jobCards, { required: true })}
            onChange={handleJobCardSelect}
            required
          />
          <Input
            label="Hotel Name"
            value={form.hotelName}
            onChange={(v) => updateForm("hotelName", v)}
            required
          />
          <Input label="City" value={form.city} onChange={(v) => updateForm("city", v)} />
          <Input
            label="Check-in"
            type="date"
            value={form.checkInDate}
            onChange={(v) => updateForm("checkInDate", v)}
          />
          <Input
            label="Check-out"
            type="date"
            value={form.checkOutDate}
            onChange={(v) => updateForm("checkOutDate", v)}
          />
          <Textarea
            label="Special Instructions"
            value={form.notes}
            onChange={(v) => updateForm("notes", v)}
          />
        </>
      )}
    </>
  );
}
