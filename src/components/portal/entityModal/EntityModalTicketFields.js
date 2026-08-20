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

  jobCards,

  travellerOptions,
  pnrOptions,

  handleJobCardSelect,
  handleTravellerSelect,
  handlePnrSelect,
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
            formField="ticketNumber"
            label="Ticket Number"
            onChange={updateForm}
            value={form.ticketNumber}
          />
          <Select
            formField="ticketType"
            label="Ticket Type"
            onChange={updateForm}
            options={TICKET_TYPES}
            value={form.ticketType}
          />
          <Select
            formField="ticketStatus"
            label="Ticket Status"
            onChange={updateForm}
            options={TICKET_STATUSES}
            value={form.ticketStatus}
          />
          <Select
            formField="paymentType"
            label="Payment Type"
            onChange={updateForm}
            options={PAYMENT_TYPES}
            value={form.paymentType}
          />
          <Select
            formField="cabinClass"
            label="Cabin Class"
            onChange={updateForm}
            options={CABIN_CLASSES}
            value={form.cabinClass}
          />
          <Select
            formField="foodPreference"
            label="Meal Preference"
            onChange={updateForm}
            options={FOOD_PREFERENCES}
            value={form.foodPreference}
          />
          <Input
            formField="seatPreference"
            label="Seat Preference"
            onChange={updateForm}
            value={form.seatPreference}
          />
          <Input
            formField="seatNumber"
            label="Seat Number"
            onChange={updateForm}
            value={form.seatNumber}
          />
        </>
      )}
    </>
  );
}
