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

export function EntityModalSeatFields({
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
      {modal === "seat" && (
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
            label="Seat Number"
            value={form.seatNumber}
            onChange={(v) => updateForm("seatNumber", v)}
            required
          />
          <Select
            label="Status"
            value={form.seatStatus}
            options={["Available", "Held", "Assigned", "Blocked"]}
            onChange={(v) => updateForm("seatStatus", v)}
          />
          <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} />
        </>
      )}
    </>
  );
}
