import type { Id } from "../_generated/dataModel";

export const LEAVE_TYPES = [
  "Privilege",
  "Casual",
  "Sick",
  "Maternity",
  "Paternity",
  "Bereavement",
  "Marriage",
  "Leave Without Pay",
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

type StaffForLeave = {
  joiningDate?: string;
  employmentStatus?: "Probationer" | "Confirmed";
};

type BalanceMap = Record<string, number>;

const MS_PER_DAY = 86400000;
const POLICY_YEAR_START_MONTH = 3;

export function inclusiveLeaveDays(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T12:00:00`);
  const end = Date.parse(`${endDate}T12:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / MS_PER_DAY) + 1;
}

export function fiscalYearForDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const year = date.getFullYear();
  return date.getMonth() >= POLICY_YEAR_START_MONTH ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function monthsElapsedInPolicyYear(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const startYear =
    date.getMonth() >= POLICY_YEAR_START_MONTH ? date.getFullYear() : date.getFullYear() - 1;
  return (date.getFullYear() - startYear) * 12 + date.getMonth() - POLICY_YEAR_START_MONTH + 1;
}

export function defaultLeaveEntitlement(
  leaveType: LeaveType,
  staff: StaffForLeave,
  startDate: string,
) {
  const isProbationer = (staff.employmentStatus ?? "Confirmed") === "Probationer";
  if (leaveType === "Leave Without Pay") return Number.POSITIVE_INFINITY;
  if (leaveType === "Privilege") {
    if (isProbationer) return 0;
    return Math.min(21, Math.max(0, monthsElapsedInPolicyYear(startDate)) * 1.75);
  }
  if (leaveType === "Casual") return 8;
  if (leaveType === "Sick") return 10;
  if (leaveType === "Maternity") return 182;
  if (leaveType === "Paternity") return isProbationer ? 5 : 10;
  if (leaveType === "Bereavement") return 5;
  if (leaveType === "Marriage") return isProbationer ? 0 : 5;
  return 0;
}

function maxAtOnce(leaveType: LeaveType, staff: StaffForLeave) {
  const isProbationer = (staff.employmentStatus ?? "Confirmed") === "Probationer";
  if (leaveType === "Casual") return 3;
  if (leaveType === "Paternity") return isProbationer ? 5 : 10;
  if (leaveType === "Bereavement") return 5;
  if (leaveType === "Marriage") return 5;
  return null;
}

export function calculateLeaveDecision({
  leaveType,
  startDate,
  endDate,
  staff,
  balances,
}: {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  staff: StaffForLeave;
  balances: BalanceMap;
}) {
  const days = inclusiveLeaveDays(startDate, endDate);
  if (days <= 0) {
    return { allowed: false, days, reason: "Choose a valid date range.", balanceAfter: 0 };
  }

  const employmentStatus = staff.employmentStatus ?? "Confirmed";
  if (employmentStatus === "Probationer" && ["Privilege", "Marriage"].includes(leaveType)) {
    return {
      allowed: false,
      days,
      reason: `${leaveType} leave is not accrued during probation.`,
      balanceAfter: balances[leaveType] ?? 0,
    };
  }

  if (leaveType === "Maternity" && staff.joiningDate) {
    const joined = Date.parse(`${staff.joiningDate}T12:00:00`);
    const start = Date.parse(`${startDate}T12:00:00`);
    const serviceDays = Number.isFinite(joined) ? Math.floor((start - joined) / MS_PER_DAY) : 0;
    if (serviceDays < 80) {
      return {
        allowed: false,
        days,
        reason: "Maternity leave requires at least 80 days of service.",
        balanceAfter: balances[leaveType] ?? 0,
      };
    }
  }

  const cap = maxAtOnce(leaveType, staff);
  if (cap && days > cap) {
    return {
      allowed: false,
      days,
      reason: `${leaveType} leave is limited to ${cap} days at once.`,
      balanceAfter: balances[leaveType] ?? 0,
    };
  }

  if (leaveType === "Leave Without Pay") {
    return { allowed: true, days, reason: "", balanceAfter: 0 };
  }

  const available = balances[leaveType] ?? defaultLeaveEntitlement(leaveType, staff, startDate);
  if (available < days) {
    return {
      allowed: false,
      days,
      reason: `Insufficient ${leaveType} leave balance.`,
      balanceAfter: available,
    };
  }
  return { allowed: true, days, reason: "", balanceAfter: available - days };
}

export function initialBalanceRows(
  staffId: Id<"staffUsers">,
  staff: StaffForLeave,
  fiscalYear: string,
) {
  const startYear = Number(fiscalYear.split("-")[0]);
  const basisDate = `${startYear + 1}-03-31`;
  return LEAVE_TYPES.flatMap((leaveType) => {
    if (leaveType === "Leave Without Pay") {
      return [];
    }
    const availableDays = defaultLeaveEntitlement(leaveType, staff, basisDate);
    const encashableDays =
      leaveType === "Privilege" && Number.isFinite(availableDays)
        ? Math.max(0, availableDays - 10)
        : 0;
    return [
      {
        staffId,
        fiscalYear,
        leaveType,
        openingDays: availableDays,
        accruedDays: 0,
        usedDays: 0,
        carriedForwardDays: Math.min(availableDays, leaveType === "Privilege" ? 10 : 0),
        encashableDays,
        availableDays,
      },
    ];
  });
}
