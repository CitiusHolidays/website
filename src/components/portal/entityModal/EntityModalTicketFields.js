"use client";

import { Input, Select } from "@/components/portal/PortalModalForm";
import {
  CABIN_CLASSES,
  FOOD_PREFERENCES,
  PAYMENT_TYPES,
  TICKET_STATUSES,
  TICKET_TYPES,
} from "@/lib/portal/constants";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";

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
            label="Ticket Number"
            onChange={(v) => updateForm("ticketNumber", v)}
            value={form.ticketNumber}
          />
          <Select
            label="Ticket Type"
            onChange={(v) => updateForm("ticketType", v)}
            options={TICKET_TYPES}
            value={form.ticketType}
          />
          <Select
            label="Ticket Status"
            onChange={(v) => updateForm("ticketStatus", v)}
            options={TICKET_STATUSES}
            value={form.ticketStatus}
          />
          <Select
            label="Payment Type"
            onChange={(v) => updateForm("paymentType", v)}
            options={PAYMENT_TYPES}
            value={form.paymentType}
          />
          <Select
            label="Cabin Class"
            onChange={(v) => updateForm("cabinClass", v)}
            options={CABIN_CLASSES}
            value={form.cabinClass}
          />
          <Select
            label="Meal Preference"
            onChange={(v) => updateForm("foodPreference", v)}
            options={FOOD_PREFERENCES}
            value={form.foodPreference}
          />
          <Input
            label="Seat Preference"
            onChange={(v) => updateForm("seatPreference", v)}
            value={form.seatPreference}
          />
          <Input
            label="Seat Number"
            onChange={(v) => updateForm("seatNumber", v)}
            value={form.seatNumber}
          />
        </>
      )}
    </>
  );
}
