"use client";

import { Input, Select } from "@/components/portal/PortalModalForm";
import { LEAVE_TYPES, PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

function leaveBalanceRowsForDisplay(leaveBalanceRows) {
  if (leaveBalanceRows === null) {
    return null;
  }

  const rowsByType = new Map((leaveBalanceRows || []).map((row) => [row.leaveType, row]));
  return LEAVE_TYPES.map((leaveType) => {
    const row = rowsByType.get(leaveType);
    if (row) {
      return {
        detail: row.fiscalYear || "",
        leaveType,
        value: Number(row.availableDays || 0).toFixed(1),
      };
    }
    if (leaveType === "Leave Without Pay") {
      return {
        detail: "No balance limit",
        leaveType,
        value: "Unpaid",
      };
    }
    return {
      detail: "No balance row",
      leaveType,
      value: "-",
    };
  });
}

export function EntityModalLeaveFields({
  modal,
  form,
  updateForm,

  has,

  team,

  leaveImpact,
  leaveBalanceRows,
}) {
  const balanceRowsForDisplay = leaveBalanceRowsForDisplay(leaveBalanceRows);

  return (
    <>
      {modal === "leave_create" && (
        <>
          {has(P.MANAGE_LEAVE) && (
            <Select
              formField="staffId"
              label="Employee"
              onChange={updateForm}
              options={team.map((t) => ({
                label: `${t.name} (${t.department || "General"})`,
                value: t.id,
              }))}
              required={!form.entityId}
              value={form.staffId}
            />
          )}
          <Select
            formField="leaveType"
            label="Leave Type"
            onChange={updateForm}
            options={LEAVE_TYPES}
            value={form.leaveType}
          />
          <Input
            formField="startDate"
            label="Start Date"
            onChange={updateForm}
            required
            type="date"
            value={form.startDate}
          />
          <Input
            formField="endDate"
            label="End Date"
            onChange={updateForm}
            required
            type="date"
            value={form.endDate}
          />
          <Input
            formField="reason"
            label="Reason for Leave"
            onChange={updateForm}
            placeholder="e.g. Annual Leave, Medical, Personal"
            required
            value={form.reason}
          />
          <div className="rounded-xl border border-brand-border bg-brand-light/70 px-4 py-3 md:col-span-2">
            <div className="mb-3 font-semibold text-citius-blue text-sm">Leave balances</div>
            {balanceRowsForDisplay === null ? (
              <div className="text-brand-muted text-sm">Loading leave balances...</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {balanceRowsForDisplay.map((row) => (
                  <div
                    className="rounded-lg border border-brand-border bg-white px-3 py-2"
                    key={row.leaveType}
                  >
                    <div className="font-medium text-brand-muted text-xs">{row.leaveType}</div>
                    <div className="mt-1 font-semibold text-brand-dark text-lg">{row.value}</div>
                    {row.detail ? (
                      <div className="mt-1 text-brand-muted text-xs">{row.detail}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          {leaveImpact ? (
            <div
              className={`rounded-xl border px-4 py-3 text-sm md:col-span-2 ${
                leaveImpact.allowed
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {leaveImpact.allowed
                ? `${leaveImpact.days} day(s). Balance after approval: ${Number(
                    leaveImpact.balanceAfter || 0
                  ).toFixed(1)}.`
                : leaveImpact.reason}
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
