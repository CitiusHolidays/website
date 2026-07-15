"use client";

import { CheckCircle2, ClipboardList, RefreshCw, ShieldCheck, Users } from "lucide-react";
import type { Key } from "react";
import { useState } from "react";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { formatDisplayDate } from "@/lib/formatDate";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { leaveBalanceRowsForDisplay } from "../portalAdminUtils";
import type { LeaveViewProps, PortalLeaveListRow } from "../portalViewTypes";
import { strong } from "../portalWorkspaceListHelpers";
import { Badge, DeleteButton, Panel, StatCard, StatusBadge } from "../portalWorkspaceListUi";

type LeaveRow = PortalLeaveListRow;

export function LeaveView({
  rows,
  access,
  leaveBalances,
  openModal,
  has,
  deleteItem,
  removeLeave,
  decideLeave,
}: LeaveViewProps) {
  const today = new Date().toISOString().split("T")[0];
  const activeCount = rows.filter(
    (row) =>
      row.startDate &&
      row.endDate &&
      row.startDate <= today &&
      row.endDate >= today &&
      row.status === "Approved"
  ).length;
  const pendingCount = rows.filter((row) => row.status === "Pending").length;
  const rejectedCount = rows.filter((row) => row.status === "Rejected").length;
  const upcomingCount = rows.filter(
    (row) => row.status === "Approved" && row.startDate && row.startDate > today
  ).length;
  const canManageLeave = has(P.MANAGE_LEAVE);
  const balanceRows = leaveBalanceRowsForDisplay(leaveBalances);
  const [decidingLeaveId, setDecidingLeaveId] = useState<string | null>(null);

  const handleLeaveDecision = async (leaveId: Key, status: string) => {
    if (decidingLeaveId) {
      return;
    }
    setDecidingLeaveId(String(leaveId));
    try {
      await decideLeave({ leaveId: String(leaveId), status });
    } catch (err) {
      console.error(err);
    }
    setDecidingLeaveId(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StatCard Icon={Users} label="Active Today" value={activeCount} />
        <StatCard Icon={RefreshCw} label="Pending Approval" value={pendingCount} />
        <StatCard Icon={CheckCircle2} label="Upcoming Approved" value={upcomingCount} />
        <StatCard Icon={ShieldCheck} label="Rejected" value={rejectedCount} />
        <StatCard Icon={ClipboardList} label="Total Recorded" value={rows.length} />
      </div>

      <Panel
        subtitle="Current fiscal-year availability before any pending request is approved."
        title="My leave balances"
      >
        {balanceRows === null ? (
          <div className="rounded-xl border border-brand-border bg-brand-light px-4 py-3 text-brand-muted text-sm">
            Loading leave balances...
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {balanceRows.map((row) => (
              <div
                className="rounded-xl border border-brand-border bg-brand-light px-4 py-3"
                key={row.leaveType}
              >
                <div className="font-medium text-brand-muted text-xs">{row.leaveType}</div>
                <div className="mt-1 font-semibold text-brand-dark text-xl">{row.value}</div>
                <div className="mt-1 text-brand-muted text-xs">{row.detail}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-sm">
        <SelectableDataTable
          columns={[
            {
              id: "employee-name",
              label: "Employee Name",
              render: (row: LeaveRow) => strong(row.staffName),
              sortValue: (row: LeaveRow) => row.staffName || "",
            },
            {
              id: "department",
              label: "Department",
              render: (row: LeaveRow) => (
                <span className="rounded-full bg-brand-border px-2.5 py-1 font-medium text-brand-text text-xs">
                  {row.department}
                </span>
              ),
            },
            {
              id: "leave-type",
              label: "Leave Type",
              render: (row: LeaveRow) => <Badge label={row.leaveType || "Casual"} tone="blue" />,
            },
            {
              id: "start-date",
              label: "Start Date",
              render: (row: LeaveRow) => formatDisplayDate(row.startDate),
              sortValue: (row: LeaveRow) => row.startDate,
            },
            {
              id: "end-date",
              label: "End Date",
              render: (row: LeaveRow) => formatDisplayDate(row.endDate),
              sortValue: (row: LeaveRow) => row.endDate,
            },
            {
              id: "reason",
              label: "Reason",
              render: (row: LeaveRow) => row.reason || "-",
            },
            {
              id: "head-review",
              label: "Head Review",
              render: (row: LeaveRow) => (
                <StatusBadge
                  domain="leaveReview"
                  label={row.headReviewStatus || row.status || "Pending"}
                  status={row.headReviewStatus || row.status}
                />
              ),
            },
            {
              id: "hr-review",
              label: "HR Review",
              render: (row: LeaveRow) => (
                <StatusBadge
                  domain="leaveReview"
                  label={row.hrReviewStatus || row.status || "Pending"}
                  status={row.hrReviewStatus || row.status}
                />
              ),
            },
            {
              id: "status",
              kind: "status",
              label: "Status",
              render: (row: LeaveRow) => <StatusBadge domain="leave" status={row.status} />,
              sortValue: (row: LeaveRow) => row.status || "",
            },
            {
              id: "action",
              kind: "action",
              label: "Action",
              render: (row: LeaveRow) => (
                <div className="flex flex-wrap gap-2">
                  {row.canApproveHead && (
                    <button
                      className="portal-small-btn"
                      disabled={decidingLeaveId === String(row.id)}
                      onClick={() => handleLeaveDecision(row.id, "Approved")}
                      type="button"
                    >
                      {decidingLeaveId === String(row.id)
                        ? "Saving…"
                        : row.headReviewerRole === "HR"
                          ? "Approve"
                          : "Approve (Head)"}
                    </button>
                  )}
                  {row.canApproveHr && (
                    <button
                      className="portal-small-btn"
                      disabled={decidingLeaveId === String(row.id)}
                      onClick={() => handleLeaveDecision(row.id, "Approved")}
                      type="button"
                    >
                      {decidingLeaveId === String(row.id) ? "Saving…" : "Approve (HR)"}
                    </button>
                  )}
                  {row.canApproveFinal && (
                    <button
                      className="portal-small-btn"
                      disabled={decidingLeaveId === String(row.id)}
                      onClick={() => handleLeaveDecision(row.id, "Approved")}
                      type="button"
                    >
                      {decidingLeaveId === String(row.id) ? "Saving…" : "Approve (Final Authority)"}
                    </button>
                  )}
                  {row.canReject && (
                    <button
                      className="portal-danger-btn"
                      disabled={decidingLeaveId === String(row.id)}
                      onClick={() => handleLeaveDecision(row.id, "Rejected")}
                      type="button"
                    >
                      Reject
                    </button>
                  )}
                  {(canManageLeave ||
                    (access?.staffId === row.staffId && row.status === "Pending")) && (
                    <button
                      className="portal-small-btn"
                      onClick={() =>
                        openModal("leave_create", {
                          endDate: row.endDate,
                          entityId: row.id,
                          leaveType: row.leaveType || "Casual",
                          reason: row.reason,
                          staffId: row.staffId,
                          startDate: row.startDate,
                          status: row.status,
                        })
                      }
                      type="button"
                    >
                      Edit
                    </button>
                  )}
                  {canManageLeave && (
                    <DeleteButton
                      label={`leave for ${row.staffName}`}
                      onClick={() =>
                        deleteItem(`leave for ${row.staffName}`, removeLeave, {
                          leaveId: String(row.id),
                        })
                      }
                    />
                  )}
                </div>
              ),
            },
          ]}
          empty="No leave records yet."
          rows={rows}
        />
      </div>
    </div>
  );
}
