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

export function EntityModalInvoiceFields({
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
      {modal === "invoice" && (
        <>
          <Select
            label="Job Card"
            value={form.jobCardId}
            options={jobCardSelectOptions(jobCards, { required: true })}
            onChange={handleJobCardSelect}
            required
          />
          <Input
            label="Invoice Number"
            value={form.invoiceNumber}
            onChange={(v) => updateForm("invoiceNumber", v)}
            required
          />
          <Input
            label="Expected Amount"
            type="number"
            value={form.expectedAmount}
            onChange={(v) => updateForm("expectedAmount", v)}
          />
          <Input
            label="Received Amount"
            type="number"
            value={form.receivedAmount}
            onChange={(v) => updateForm("receivedAmount", v)}
          />
          <Input
            label="Due Date"
            type="date"
            value={form.dueDate}
            onChange={(v) => updateForm("dueDate", v)}
          />
        </>
      )}
    </>
  );
}
