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

export function EntityModalTicketFields({
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
      {modal === "ticket" && (
        <>
          <Select
            label="Job Card"
            value={form.jobCardId}
            options={jobCardSelectOptions(jobCards, { required: true })}
            onChange={handleJobCardSelect}
            required
          />
          <Select
            label="Traveller"
            value={form.travellerId}
            options={travellerOptions}
            onChange={handleTravellerSelect}
          />
          <Select label="PNR" value={form.pnrId} options={pnrOptions} onChange={handlePnrSelect} />
          <Input
            label="Ticket Number"
            value={form.ticketNumber}
            onChange={(v) => updateForm("ticketNumber", v)}
          />
          <Select
            label="Ticket Type"
            value={form.ticketType}
            options={TICKET_TYPES}
            onChange={(v) => updateForm("ticketType", v)}
          />
          <Select
            label="Ticket Status"
            value={form.ticketStatus}
            options={TICKET_STATUSES}
            onChange={(v) => updateForm("ticketStatus", v)}
          />
          <Select
            label="Payment Type"
            value={form.paymentType}
            options={PAYMENT_TYPES}
            onChange={(v) => updateForm("paymentType", v)}
          />
          <Select
            label="Cabin Class"
            value={form.cabinClass}
            options={CABIN_CLASSES}
            onChange={(v) => updateForm("cabinClass", v)}
          />
          <Select
            label="Meal Preference"
            value={form.foodPreference}
            options={FOOD_PREFERENCES}
            onChange={(v) => updateForm("foodPreference", v)}
          />
          <Input
            label="Seat Preference"
            value={form.seatPreference}
            onChange={(v) => updateForm("seatPreference", v)}
          />
          <Input
            label="Seat Number"
            value={form.seatNumber}
            onChange={(v) => updateForm("seatNumber", v)}
          />
        </>
      )}
    </>
  );
}
