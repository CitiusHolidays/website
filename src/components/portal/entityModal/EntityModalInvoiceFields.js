"use client";

import { Input, Select } from "@/components/portal/PortalModalForm";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";

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
            onChange={handleJobCardSelect}
            options={jobCardSelectOptions(jobCards, { required: true })}
            required
            value={form.jobCardId}
          />
          <Input
            label="Invoice Number"
            onChange={(v) => updateForm("invoiceNumber", v)}
            required
            value={form.invoiceNumber}
          />
          <Input
            label="Expected Amount"
            onChange={(v) => updateForm("expectedAmount", v)}
            type="number"
            value={form.expectedAmount}
          />
          <Input
            label="Received Amount"
            onChange={(v) => updateForm("receivedAmount", v)}
            type="number"
            value={form.receivedAmount}
          />
          <Input
            label="Due Date"
            onChange={(v) => updateForm("dueDate", v)}
            type="date"
            value={form.dueDate}
          />
        </>
      )}
    </>
  );
}
