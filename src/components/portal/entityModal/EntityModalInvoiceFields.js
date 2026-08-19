"use client";

import { Input, Select } from "@/components/portal/PortalModalForm";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";

export function EntityModalInvoiceFields({
  modal,
  form,
  updateForm,

  jobCards,

  handleJobCardSelect,
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
            formField="invoiceNumber"
            label="Invoice Number"
            onChange={updateForm}
            required
            value={form.invoiceNumber}
          />
          <Input
            formField="expectedAmount"
            label="Expected Amount"
            onChange={updateForm}
            type="number"
            value={form.expectedAmount}
          />
          <Input
            formField="receivedAmount"
            label="Received Amount"
            onChange={updateForm}
            type="number"
            value={form.receivedAmount}
          />
          <Input
            formField="dueDate"
            label="Due Date"
            onChange={updateForm}
            type="date"
            value={form.dueDate}
          />
        </>
      )}
    </>
  );
}
