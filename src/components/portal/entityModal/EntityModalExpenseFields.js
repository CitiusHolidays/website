"use client";

import { useCallback } from "react";
import {
  Input,
  money,
  QueryFilePicker,
  Select,
  Textarea,
} from "@/components/portal/PortalModalForm";
import { EXPENSE_CURRENCIES, EXPENSE_HEADS } from "@/lib/portal/constants";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";
import { getExpenseSplitTotal } from "@/lib/portal/workflow";
import { propertiesWhen } from "../../../lib/runtimeValues";

export function EntityModalExpenseFields({
  modal,
  form,
  updateForm,
  patchForm,

  jobCards,

  pendingExpenseProofFiles,
  setPendingExpenseProofFiles,
  handleJobCardSelect,

  fieldErrors = {},
}) {
  const handleExpenseType = useCallback(
    (value) =>
      patchForm({
        expenseType: value,
        ...propertiesWhen(value === "office", () => ({ jobCardId: "" })),
      }),
    [patchForm]
  );
  const handleProofFiles = useCallback(
    (files) => setPendingExpenseProofFiles(files.slice(-1)),
    [setPendingExpenseProofFiles]
  );
  return (
    <>
      {modal === "expense" && (
        <>
          <Select
            label="Expense Type"
            onChange={handleExpenseType}
            options={[
              { label: "Job Card", value: "jobCard" },
              { label: "Office / General", value: "office" },
            ]}
            value={form.expenseType}
          />
          {form.expenseType === "jobCard" && (
            <Select
              error={fieldErrors.jobCardId}
              fieldKey="jobCardId"
              label="Job Card"
              onChange={handleJobCardSelect}
              options={jobCardSelectOptions(jobCards, { required: true })}
              required
              value={form.jobCardId}
            />
          )}
          <Input
            formField="tourManagerName"
            label="Tour Manager"
            onChange={updateForm}
            value={form.tourManagerName}
          />
          <Input
            error={fieldErrors.expenseDate}
            fieldKey="expenseDate"
            formField="expenseDate"
            label="Expense Date"
            onChange={updateForm}
            type="date"
            value={form.expenseDate}
          />
          <Select
            error={fieldErrors.category}
            fieldKey="category"
            formField="category"
            label="Category"
            onChange={updateForm}
            options={[{ label: "Select category…", value: "" }, ...EXPENSE_HEADS]}
            required
            value={form.category}
          />
          <Select
            formField="currency"
            label="Currency"
            onChange={updateForm}
            options={EXPENSE_CURRENCIES}
            value={form.currency}
          />
          <Input
            error={fieldErrors.cardAmount}
            fieldKey="cardAmount"
            formField="cardAmount"
            label="Card Amount"
            onChange={updateForm}
            type="number"
            value={form.cardAmount}
          />
          <Input
            error={fieldErrors.cashAmount}
            fieldKey="cashAmount"
            formField="cashAmount"
            label="Cash Amount"
            onChange={updateForm}
            type="number"
            value={form.cashAmount}
          />
          <Input
            error={fieldErrors.epayAmount}
            fieldKey="epayAmount"
            formField="epayAmount"
            label="E-Pay Amount"
            onChange={updateForm}
            type="number"
            value={form.epayAmount}
          />
          <div className="rounded-xl border border-brand-border bg-brand-light px-3 py-2">
            <span className="mb-1 block font-semibold text-brand-muted text-xs">Total Amount</span>
            <div className="font-semibold text-brand-text text-sm">
              {money(
                getExpenseSplitTotal({
                  cardAmount: form.cardAmount,
                  cashAmount: form.cashAmount,
                  epayAmount: form.epayAmount,
                })
              )}
            </div>
          </div>
          <Input
            error={fieldErrors.paidBy}
            fieldKey="paidBy"
            formField="paidBy"
            label="Paid By"
            onChange={updateForm}
            required
            value={form.paidBy}
          />
          <Textarea
            formField="particulars"
            label="Particulars"
            onChange={updateForm}
            value={form.particulars}
          />
          <div className="md:col-span-2">
            <QueryFilePicker
              files={pendingExpenseProofFiles}
              inputId="expense-proof-files"
              onChange={handleProofFiles}
            />
          </div>
        </>
      )}
    </>
  );
}
