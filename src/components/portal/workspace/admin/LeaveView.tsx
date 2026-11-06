"use client";

import type { Key, RefObject } from "react";
import { useRef, useState } from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { QueryRowActions } from "@/components/portal/QueryRowActions";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { formatDisplayDate } from "@/lib/formatDate";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import type { LeaveViewProps } from "../portalViewTypes";
import { formatConvexError, strong } from "../portalWorkspaceListHelpers";
import { Badge, DeleteButton, Panel, StatusBadge } from "../portalWorkspaceListUi";
import {
  awayTodaySummary,
  isAwaitingMyApproval,
  istDateKey,
  type LeaveDecision,
  type LeaveListRow,
  leaveApprovalActions,
  leaveBalancesForDisplay,
  leaveDateRange,
  leaveDurationText,
  leaveProgressText,
  missingBalancesText,
  namesAwayOn,
  rowsWaitingForApproval,
} from "./leaveViewModel";

type DecideHandler = (row: LeaveListRow, status: LeaveDecision) => Promise<void>;

function LeaveDecisionButton({
  accessibleName,
  className,
  disabled,
  label,
  onDecide,
  row,
  status,
}: {
  accessibleName?: string;
  className: string;
  disabled: boolean;
  label: string;
  onDecide: DecideHandler;
  row: LeaveListRow;
  status: LeaveDecision;
}) {
  const handleClick = () => onDecide(row, status);
  return (
    <button
      aria-label={accessibleName}
      className={className}
      disabled={disabled}
      onClick={handleClick}
      type="button"
    >
      {label}
    </button>
  );
}

/** The approve buttons that apply to this row, then Reject. Shared by the table and the queue. */
function LeaveDecisionButtons({
  decidingLeaveId,
  extraClassName = "",
  nameSuffix,
  onDecide,
  row,
}: {
  decidingLeaveId: string | null;
  extraClassName?: string;
  nameSuffix?: string;
  onDecide: DecideHandler;
  row: LeaveListRow;
}) {
  const isSaving = decidingLeaveId === String(row.id);
  const named = (label: string) => (nameSuffix ? `${label} ${nameSuffix}` : undefined);
  return (
    <>
      {leaveApprovalActions(row).map((action) => (
        <LeaveDecisionButton
          accessibleName={isSaving ? undefined : named(action.label)}
          className={`portal-small-btn ${extraClassName}`.trim()}
          disabled={isSaving}
          key={action.key}
          label={isSaving ? "Saving…" : action.label}
          onDecide={onDecide}
          row={row}
          status="Approved"
        />
      ))}
      {row.canReject ? (
        <LeaveDecisionButton
          accessibleName={named("Reject")}
          className={`portal-danger-btn ${extraClassName}`.trim()}
          disabled={isSaving}
          label="Reject"
          onDecide={onDecide}
          row={row}
          status="Rejected"
        />
      ) : null}
    </>
  );
}

function LeaveRowActions({
  access,
  canManageLeave,
  decidingLeaveId,
  deleteItem,
  onDecide,
  openModal,
  removeLeave,
  row,
}: {
  access: LeaveViewProps["access"];
  canManageLeave: boolean;
  decidingLeaveId: string | null;
  deleteItem: LeaveViewProps["deleteItem"];
  onDecide: DecideHandler;
  openModal: LeaveViewProps["openModal"];
  removeLeave: LeaveViewProps["removeLeave"];
  row: LeaveListRow;
}) {
  const recordLabel = `leave for ${row.staffName}`;
  const edit = () => {
    openModal("leave_create", {
      endDate: row.endDate,
      entityId: String(row.id),
      leaveType: row.leaveType || "Casual",
      reason: row.reason,
      staffId: row.staffId,
      startDate: row.startDate,
      status: row.status,
    });
  };
  const remove = () => {
    deleteItem(recordLabel, removeLeave, { leaveId: String(row.id) });
  };
  const canEditOwnRequest = access.staffId === row.staffId && row.status === "Pending";
  const editButton = (
    <button className="portal-small-btn" key="edit" onClick={edit} type="button">
      Edit
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
      <LeaveDecisionButtons decidingLeaveId={decidingLeaveId} onDecide={onDecide} row={row} />
      {canManageLeave ? (
        <QueryRowActions
          label={recordLabel}
          overflowActions={[
            editButton,
            <DeleteButton
              className="portal-danger-btn"
              key="delete"
              label={recordLabel}
              onClick={remove}
              type="button"
            />,
          ]}
        />
      ) : null}
      {!canManageLeave && canEditOwnRequest ? editButton : null}
    </div>
  );
}

function LeaveProgress({ row }: { row: LeaveListRow }) {
  const progress = leaveProgressText(row);
  return (
    <div className="flex min-w-0 flex-col items-start gap-1 md:min-w-36">
      <StatusBadge domain="leave" status={row.status} />
      {progress ? (
        <span className="max-w-52 text-brand-muted text-xs leading-snug">{progress}</span>
      ) : null}
    </div>
  );
}

function WaitingForApproval({
  decidingLeaveId,
  headingRef,
  onDecide,
  rows,
}: {
  decidingLeaveId: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onDecide: DecideHandler;
  rows: LeaveListRow[];
}) {
  return (
    <section
      aria-labelledby="leave-waiting-heading"
      className="rounded-2xl border border-brand-border/70 bg-white/95 p-4 shadow-[0_12px_34px_rgba(16,42,131,0.045)] md:p-5"
    >
      <h2
        className="font-heading font-semibold text-brand-dark text-sm focus-visible:outline-none"
        id="leave-waiting-heading"
        ref={headingRef}
        tabIndex={-1}
      >
        Waiting for your approval
        <span className="ml-2 text-brand-muted tabular-nums">{rows.length}</span>
      </h2>
      <p className="mt-1 text-brand-muted text-xs">
        Soonest start first. Each approval moves a request to its next stage.
      </p>
      <ul className="mt-3 divide-y divide-brand-border/70">
        {rows.map((row) => {
          const progress = leaveProgressText(row);
          const duration = leaveDurationText(row);
          return (
            <li
              className="flex flex-col gap-3 py-3 last:pb-0 md:flex-row md:items-center md:justify-between md:gap-6"
              key={row.id}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-brand-dark text-sm">{row.staffName}</span>
                  <Badge label={row.leaveType || "Casual"} tone="blue" />
                </div>
                <p className="text-brand-text text-sm tabular-nums">
                  {leaveDateRange(row)}
                  {duration ? <span className="text-brand-muted"> · {duration}</span> : null}
                  {row.department ? (
                    <span className="text-brand-muted"> · {row.department}</span>
                  ) : null}
                </p>
                {row.reason ? (
                  <p className="text-pretty text-brand-muted text-xs">{row.reason}</p>
                ) : null}
                {progress ? <p className="text-brand-muted text-xs">{progress}</p> : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <LeaveDecisionButtons
                  decidingLeaveId={decidingLeaveId}
                  extraClassName="min-h-11 md:min-h-10"
                  nameSuffix={`for ${row.staffName}`}
                  onDecide={onDecide}
                  row={row}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AwayToday({ names }: { names: string[] }) {
  return (
    <p className="rounded-xl border border-brand-border/70 bg-white/95 px-4 py-3 text-brand-text text-sm">
      <span className="font-semibold text-brand-dark">Away today</span>
      <span className="text-brand-muted"> · </span>
      {awayTodaySummary(names)}
    </p>
  );
}

function LeaveBalances({ leaveBalances }: Pick<LeaveViewProps, "leaveBalances">) {
  const balances = leaveBalancesForDisplay(leaveBalances);
  return (
    <Panel
      subtitle="Current fiscal-year availability before any pending request is approved."
      title="My leave balances"
    >
      {balances === null ? (
        <div className="rounded-xl border border-brand-border bg-brand-light px-4 py-3 text-brand-muted text-sm">
          Loading leave balances…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {balances.shown.map((row) => (
              <div
                className="rounded-xl border border-brand-border bg-brand-light px-4 py-3"
                key={row.leaveType}
              >
                <div className="font-medium text-brand-muted text-xs">{row.leaveType}</div>
                <div className="mt-1 font-semibold text-brand-dark text-xl tabular-nums">
                  {row.value}
                </div>
                <div className="mt-1 text-brand-muted text-xs">{row.detail}</div>
              </div>
            ))}
          </div>
          {balances.missing.length > 0 ? (
            <p className="mt-3 text-brand-muted text-xs">{missingBalancesText(balances.missing)}</p>
          ) : null}
        </>
      )}
    </Panel>
  );
}

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
  const toast = usePortalToast();
  const leaveRows: LeaveListRow[] = rows;
  const today = istDateKey(new Date());
  const canManageLeave = has(P.MANAGE_LEAVE);
  const waiting = rowsWaitingForApproval(leaveRows);
  const seesOthers =
    canManageLeave || leaveRows.some((row) => row.staffId && row.staffId !== access.staffId);
  const [decidingLeaveId, setDecidingLeaveId] = useState<string | null>(null);
  const waitingHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const handleLeaveDecision = async (row: LeaveListRow, status: LeaveDecision) => {
    if (decidingLeaveId) {
      return;
    }
    const leaveId: Key = row.id;
    const fromQueue = isAwaitingMyApproval(row);
    setDecidingLeaveId(String(leaveId));
    try {
      await decideLeave({ leaveId: String(leaveId), status });
      toast.success(
        status === "Approved"
          ? `Approval recorded for ${row.staffName}`
          : `Leave rejected for ${row.staffName}`
      );
    } catch (err) {
      console.error(err);
      toast.error(formatConvexError(err, "Couldn't save the decision. Try again."));
    }
    setDecidingLeaveId(null);
    if (fromQueue) {
      // The decided request leaves the queue; keep keyboard focus in the queue, not on <body>.
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!active || active === document.body) {
          waitingHeadingRef.current?.focus();
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      {waiting.length > 0 ? (
        <WaitingForApproval
          decidingLeaveId={decidingLeaveId}
          headingRef={waitingHeadingRef}
          onDecide={handleLeaveDecision}
          rows={waiting}
        />
      ) : null}

      {seesOthers ? <AwayToday names={namesAwayOn(leaveRows, today)} /> : null}

      <LeaveBalances leaveBalances={leaveBalances} />

      <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-sm">
        <SelectableDataTable
          columns={[
            {
              id: "employee-name",
              kind: "identity",
              label: "Employee",
              render: (row: LeaveListRow) => (
                <div className="min-w-0">
                  {strong(row.staffName)}
                  {row.department ? (
                    <div className="mt-0.5 text-brand-muted text-xs">{row.department}</div>
                  ) : null}
                </div>
              ),
              sortValue: (row: LeaveListRow) => row.staffName || "",
            },
            {
              id: "leave-type",
              label: "Leave Type",
              render: (row: LeaveListRow) => (
                <span className="whitespace-nowrap">
                  <Badge label={row.leaveType || "Casual"} tone="blue" />
                </span>
              ),
            },
            {
              id: "start-date",
              label: "Start Date",
              render: (row: LeaveListRow) => formatDisplayDate(row.startDate),
              sortValue: (row: LeaveListRow) => row.startDate,
            },
            {
              id: "end-date",
              label: "End Date",
              render: (row: LeaveListRow) => formatDisplayDate(row.endDate),
              sortValue: (row: LeaveListRow) => row.endDate,
            },
            {
              hideable: true,
              id: "reason",
              label: "Reason",
              render: (row: LeaveListRow) => row.reason || "-",
            },
            {
              id: "status",
              kind: "status",
              label: "Progress",
              render: (row: LeaveListRow) => <LeaveProgress row={row} />,
              sortValue: (row: LeaveListRow) => row.status || "",
            },
            {
              id: "action",
              kind: "action",
              label: "Action",
              render: (row: LeaveListRow) => (
                <LeaveRowActions
                  access={access}
                  canManageLeave={canManageLeave}
                  decidingLeaveId={decidingLeaveId}
                  deleteItem={deleteItem}
                  onDecide={handleLeaveDecision}
                  openModal={openModal}
                  removeLeave={removeLeave}
                  row={row}
                />
              ),
              width: waiting.length > 0 ? 272 : undefined,
            },
          ]}
          empty="No leave records yet."
          rows={leaveRows}
        />
      </div>
    </div>
  );
}
