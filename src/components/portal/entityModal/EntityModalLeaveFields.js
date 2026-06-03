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

export function EntityModalLeaveFields({
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
      {modal === "leave_create" && (
        <>
          {has(P.MANAGE_LEAVE) && (
            <Select
              label="Employee"
              value={form.staffId}
              options={team.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.department || "General"})`,
              }))}
              onChange={(v) => updateForm("staffId", v)}
              required={!form.entityId}
            />
          )}
          <Select
            label="Leave Type"
            value={form.leaveType}
            options={LEAVE_TYPES}
            onChange={(v) => updateForm("leaveType", v)}
          />
          <Input
            label="Start Date"
            type="date"
            value={form.startDate}
            onChange={(v) => updateForm("startDate", v)}
            required
          />
          <Input
            label="End Date"
            type="date"
            value={form.endDate}
            onChange={(v) => updateForm("endDate", v)}
            required
          />
          <Input
            label="Reason for Leave"
            value={form.reason}
            onChange={(v) => updateForm("reason", v)}
            required
            placeholder="e.g. Annual Leave, Medical, Personal"
          />
          {leaveImpact && (
            <div
              className={`md:col-span-2 rounded-xl border px-4 py-3 text-sm ${
                leaveImpact.allowed
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {leaveImpact.allowed
                ? `${leaveImpact.days} day(s). Balance after approval: ${Number(
                    leaveImpact.balanceAfter || 0,
                  ).toFixed(1)}.`
                : leaveImpact.reason}
            </div>
          )}
          {has(P.MANAGE_LEAVE) && !form.entityId && (
            <Select
              label="Status"
              value={form.status || "Pending"}
              options={["Approved", "Pending", "Rejected"]}
              onChange={(v) => updateForm("status", v)}
            />
          )}
        </>
      )}
    </>
  );
}
