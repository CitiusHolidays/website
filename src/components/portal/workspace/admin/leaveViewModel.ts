import { formatDisplayDate } from "@/lib/formatDate";
import { leaveBalanceRowsForDisplay } from "../portalAdminUtils";
import type { PortalLeaveBalanceRow, PortalLeaveListRow } from "../portalViewTypes";

/** The leave list row as the server sends it, including the reviewer fields this view reads. */
export type LeaveListRow = PortalLeaveListRow & {
  finalAuthorityName?: string;
  finalReviewStatus?: string;
  headApproverName?: string;
};

export type LeaveDecision = "Approved" | "Rejected";

const LEAVE_TIME_ZONE = "Asia/Kolkata";
const NAMES_SHOWN_BEFORE_MORE = 3;
const UNASSIGNED_APPROVER = "Not assigned";

const istDateParts = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  timeZone: LEAVE_TIME_ZONE,
  year: "numeric",
});

const nameList = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });

/** Today's calendar date in India (IST), as the YYYY-MM-DD key leave rows use. */
export function istDateKey(now: Date): string {
  const parts = Object.fromEntries(
    istDateParts.formatToParts(now).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isAwaitingMyApproval(row: LeaveListRow): boolean {
  return Boolean(row.canApproveHead || row.canApproveHr || row.canApproveFinal);
}

/** Rows the current user can approve, soonest start date first. */
export function rowsWaitingForApproval(rows: readonly LeaveListRow[]): LeaveListRow[] {
  // filter() returns a new array, so sorting it never reorders the caller's rows.
  return rows
    .filter(isAwaitingMyApproval)
    .sort((left, right) =>
      (left.startDate || "9999-12-31").localeCompare(right.startDate || "9999-12-31")
    );
}

/** Names of people on approved leave on `day`, one entry per person. */
export function namesAwayOn(rows: readonly LeaveListRow[], day: string): string[] {
  const names = new Map<string, string>();
  for (const row of rows) {
    if (
      row.status === "Approved" &&
      row.startDate &&
      row.endDate &&
      row.startDate <= day &&
      row.endDate >= day
    ) {
      names.set(String(row.staffId || row.staffName), row.staffName || "Unnamed");
    }
  }
  return [...names.values()];
}

export function awayTodaySummary(names: readonly string[]): string {
  if (names.length === 0) {
    return "No one is on approved leave today.";
  }
  if (names.length <= NAMES_SHOWN_BEFORE_MORE + 1) {
    return nameList.format(names);
  }
  const hidden = names.length - NAMES_SHOWN_BEFORE_MORE;
  return nameList.format([...names.slice(0, NAMES_SHOWN_BEFORE_MORE), `${hidden} more`]);
}

function approverName(name: string | undefined) {
  return name && name !== UNASSIGNED_APPROVER ? name : "";
}

function withName(text: string, name: string | undefined) {
  const person = approverName(name);
  return person ? `${text} (${person})` : text;
}

/** Where a request stands, in words. Empty for an approved request: its badge already says so. */
export function leaveProgressText(row: LeaveListRow): string {
  if (row.status === "Approved") {
    return "";
  }
  if (row.status === "Rejected") {
    if (row.headReviewStatus === "Rejected") {
      return "Rejected by head";
    }
    if (row.finalReviewStatus === "Rejected") {
      return "Rejected by final authority";
    }
    return row.hrReviewStatus === "Rejected" ? "Rejected by HR" : "";
  }
  if (row.headReviewStatus !== "Approved") {
    return withName("Waiting for head approval", row.headApproverName);
  }
  if (row.finalReviewStatus === "Pending") {
    return withName("Head approved · waiting for final authority", row.finalAuthorityName);
  }
  return "Head approved · waiting for HR";
}

export interface LeaveApprovalAction {
  key: "final" | "head" | "hr";
  label: string;
}

/** The approve buttons this user may press, labelled as before. Each calls the same decision. */
export function leaveApprovalActions(row: LeaveListRow): LeaveApprovalAction[] {
  const actions: LeaveApprovalAction[] = [];
  if (row.canApproveHead) {
    actions.push({
      key: "head",
      label: row.headReviewerRole === "HR" ? "Approve" : "Approve (Head)",
    });
  }
  if (row.canApproveHr) {
    actions.push({ key: "hr", label: "Approve (HR)" });
  }
  if (row.canApproveFinal) {
    actions.push({ key: "final", label: "Approve (Final Authority)" });
  }
  return actions;
}

const MS_PER_DAY = 86_400_000;

function leaveDayCount(row: LeaveListRow): number | null {
  const start = Date.parse(`${row.startDate}T00:00:00Z`);
  const end = Date.parse(`${row.endDate}T00:00:00Z`);
  if (!(Number.isFinite(start) && Number.isFinite(end)) || end < start) {
    return null;
  }
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

export function leaveDateRange(row: LeaveListRow): string {
  const start = formatDisplayDate(row.startDate);
  if (!row.endDate || row.endDate === row.startDate) {
    return start;
  }
  return `${start} – ${formatDisplayDate(row.endDate)}`;
}

export function leaveDurationText(row: LeaveListRow): string {
  const days = leaveDayCount(row);
  if (days === null) {
    return "";
  }
  return days === 1 ? "1 day" : `${days} days`;
}

export interface LeaveBalanceDisplay {
  missing: string[];
  shown: Array<{ detail: string; leaveType: string; value: string }>;
}

/**
 * Splits the shared balance rows into the types this person has (plus Leave Without Pay, which
 * never needs a balance) and the names of the types with no balance this year.
 */
export function leaveBalancesForDisplay(
  leaveBalances: PortalLeaveBalanceRow[] | undefined
): LeaveBalanceDisplay | null {
  const rows = leaveBalanceRowsForDisplay(leaveBalances);
  if (rows === null) {
    return null;
  }
  const withBalance = new Set((leaveBalances ?? []).map((row) => row.leaveType));
  const display: LeaveBalanceDisplay = { missing: [], shown: [] };
  for (const row of rows) {
    if (withBalance.has(row.leaveType) || row.leaveType === "Leave Without Pay") {
      display.shown.push(row);
    } else {
      display.missing.push(row.leaveType);
    }
  }
  return display;
}

export function missingBalancesText(missing: readonly string[]): string {
  return missing.length === 0 ? "" : `No balance this year: ${nameList.format(missing)}.`;
}
