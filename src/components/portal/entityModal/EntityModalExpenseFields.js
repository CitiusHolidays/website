"use client";

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
  return (
    <>
      {modal === "expense" && (
        <>
          <Select
            label="Expense Type"
            onChange={(v) =>
              patchForm({
                expenseType: v,
                ...propertiesWhen(v === "office", () => ({ jobCardId: "" })),
              })
            }
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
            label="Tour Manager"
            onChange={(v) => updateForm("tourManagerName", v)}
            value={form.tourManagerName}
          />
          <Input
            error={fieldErrors.expenseDate}
            fieldKey="expenseDate"
            label="Expense Date"
            onChange={(v) => updateForm("expenseDate", v)}
            type="date"
            value={form.expenseDate}
          />
          <Select
            error={fieldErrors.category}
            fieldKey="category"
            label="Category"
            onChange={(v) => updateForm("category", v)}
            options={[{ label: "Select category…", value: "" }, ...EXPENSE_HEADS]}
            required
            value={form.category}
          />
          <Select
            label="Currency"
            onChange={(v) => updateForm("currency", v)}
            options={EXPENSE_CURRENCIES}
            value={form.currency}
          />
          <Input
            error={fieldErrors.cardAmount}
            fieldKey="cardAmount"
            label="Card Amount"
            onChange={(v) => updateForm("cardAmount", v)}
            type="number"
            value={form.cardAmount}
          />
          <Input
            error={fieldErrors.cashAmount}
            fieldKey="cashAmount"
            label="Cash Amount"
            onChange={(v) => updateForm("cashAmount", v)}
            type="number"
            value={form.cashAmount}
          />
          <Input
            error={fieldErrors.epayAmount}
            fieldKey="epayAmount"
            label="E-Pay Amount"
            onChange={(v) => updateForm("epayAmount", v)}
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
            label="Paid By"
            onChange={(v) => updateForm("paidBy", v)}
            required
            value={form.paidBy}
          />
          <Textarea
            label="Particulars"
            onChange={(v) => updateForm("particulars", v)}
            value={form.particulars}
          />
          <div className="md:col-span-2">
            <QueryFilePicker
              files={pendingExpenseProofFiles}
              inputId="expense-proof-files"
              onChange={(files) => setPendingExpenseProofFiles(files.slice(-1))}
            />
          </div>
        </>
      )}
    </>
  );
}
