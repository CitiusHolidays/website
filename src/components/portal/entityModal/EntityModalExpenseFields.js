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

export function EntityModalExpenseFields({
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
      {modal === "expense" && (
        <>
          <Select
            label="Expense Type"
            onChange={(v) =>
              patchForm({
                expenseType: v,
                ...(v === "office" ? { jobCardId: "" } : {}),
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
            label="Expense Date"
            onChange={(v) => updateForm("expenseDate", v)}
            type="date"
            value={form.expenseDate}
          />
          <Select
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
            label="Card Amount"
            onChange={(v) => updateForm("cardAmount", v)}
            type="number"
            value={form.cardAmount}
          />
          <Input
            label="Cash Amount"
            onChange={(v) => updateForm("cashAmount", v)}
            type="number"
            value={form.cashAmount}
          />
          <Input
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
