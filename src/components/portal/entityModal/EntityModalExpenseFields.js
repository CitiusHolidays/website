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
            value={form.expenseType}
            options={[
              { value: "jobCard", label: "Job Card" },
              { value: "office", label: "Office / General" },
            ]}
            onChange={(v) =>
              patchForm({
                expenseType: v,
                ...(v === "office" ? { jobCardId: "" } : {}),
              })
            }
          />
          {form.expenseType === "jobCard" && (
            <Select
              label="Job Card"
              value={form.jobCardId}
              options={jobCardSelectOptions(jobCards, { required: true })}
              onChange={handleJobCardSelect}
              required
            />
          )}
          <Input
            label="Tour Manager"
            value={form.tourManagerName}
            onChange={(v) => updateForm("tourManagerName", v)}
          />
          <Input
            label="Expense Date"
            type="date"
            value={form.expenseDate}
            onChange={(v) => updateForm("expenseDate", v)}
          />
          <Select
            label="Category"
            value={form.category}
            options={[{ value: "", label: "Select category…" }, ...EXPENSE_HEADS]}
            onChange={(v) => updateForm("category", v)}
            required
          />
          <Select
            label="Currency"
            value={form.currency}
            options={EXPENSE_CURRENCIES}
            onChange={(v) => updateForm("currency", v)}
          />
          <Input
            label="Card Amount"
            type="number"
            value={form.cardAmount}
            onChange={(v) => updateForm("cardAmount", v)}
          />
          <Input
            label="Cash Amount"
            type="number"
            value={form.cashAmount}
            onChange={(v) => updateForm("cashAmount", v)}
          />
          <Input
            label="E-Pay Amount"
            type="number"
            value={form.epayAmount}
            onChange={(v) => updateForm("epayAmount", v)}
          />
          <div className="rounded-xl border border-brand-border bg-brand-light px-3 py-2">
            <span className="mb-1 block text-xs font-semibold text-brand-muted">Total Amount</span>
            <div className="text-sm font-semibold text-brand-text">
              {money(
                getExpenseSplitTotal({
                  cardAmount: form.cardAmount,
                  cashAmount: form.cashAmount,
                  epayAmount: form.epayAmount,
                }),
              )}
            </div>
          </div>
          <Input
            label="Paid By"
            value={form.paidBy}
            onChange={(v) => updateForm("paidBy", v)}
            required
          />
          <Textarea
            label="Particulars"
            value={form.particulars}
            onChange={(v) => updateForm("particulars", v)}
          />
          <div className="md:col-span-2">
            <QueryFilePicker
              files={pendingExpenseProofFiles}
              onChange={(files) => setPendingExpenseProofFiles(files.slice(-1))}
              inputId="expense-proof-files"
            />
          </div>
        </>
      )}
    </>
  );
}
