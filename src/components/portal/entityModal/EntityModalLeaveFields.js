"use client";

import { Input, Select } from "@/components/portal/PortalModalForm";
import { LEAVE_TYPES, PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

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
  leaveBalanceRows,
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
          {leaveBalanceRows?.length > 0 && (
            <div className="md:col-span-2 rounded-xl border border-brand-border bg-brand-light/70 px-4 py-3">
              <div className="mb-3 text-sm font-semibold text-citius-blue">Leave balances</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {leaveBalanceRows.map((row) => (
                  <div
                    key={row.leaveType}
                    className="rounded-lg border border-brand-border bg-white px-3 py-2"
                  >
                    <div className="text-xs font-medium text-brand-muted">{row.leaveType}</div>
                    <div className="mt-1 text-lg font-semibold text-brand-dark">
                      {Number(row.availableDays || 0).toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
