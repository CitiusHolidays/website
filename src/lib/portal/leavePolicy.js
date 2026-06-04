export const LEAVE_POLICY_YEAR_START_MONTH = 3; // April, zero-based month.

export const LEAVE_POLICY = {
  Privilege: {
    probationerAllowed: false,
    confirmedAnnualEntitlement: 21,
    accrualPerMonth: 1.75,
    carryForwardMax: 10,
    encashableAbove: 10,
  },
  Casual: {
    probationerAnnualEntitlement: 8,
    confirmedAnnualEntitlement: 8,
    maxAtOnce: 3,
    lapsesOn: "31 Mar",
  },
  Sick: {
    probationerAnnualEntitlement: 10,
    confirmedAnnualEntitlement: 10,
    lapsesOn: "31 Mar",
  },
  Maternity: {
    eligibleAfterDays: 80,
    maxAtOnce: 182,
  },
  Paternity: {
    probationerMaxAtOnce: 5,
    maxAtOnce: 10,
  },
  Bereavement: {
    maxAtOnce: 5,
  },
  Marriage: {
    probationerAllowed: false,
    maxAtOnce: 5,
  },
  "Leave Without Pay": {
    unpaid: true,
  },
};

export function inclusiveLeaveDays(startDate, endDate) {
  const start = Date.parse(`${startDate}T12:00:00`);
  const end = Date.parse(`${endDate}T12:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

export function fiscalYearForDate(value) {
  const date = new Date(`${value}T12:00:00`);
  const year = date.getFullYear();
  return date.getMonth() >= LEAVE_POLICY_YEAR_START_MONTH
    ? `${year}-${year + 1}`
    : `${year - 1}-${year}`;
}

function monthsElapsedInPolicyYear(value) {
  const date = new Date(`${value}T12:00:00`);
  const startYear =
    date.getMonth() >= LEAVE_POLICY_YEAR_START_MONTH ? date.getFullYear() : date.getFullYear() - 1;
  return (
    (date.getFullYear() - startYear) * 12 + date.getMonth() - LEAVE_POLICY_YEAR_START_MONTH + 1
  );
}

export function defaultLeaveEntitlement(leaveType, employmentStatus = "Confirmed", startDate = "") {
  const isProbationer = employmentStatus === "Probationer";
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

export function calculateLeaveRequestImpact({
  leaveType,
  startDate,
  endDate,
  employmentStatus = "Confirmed",
  joiningDate = "",
  balances = {},
}) {
  const days = inclusiveLeaveDays(startDate, endDate);
  if (days <= 0) {
    return { allowed: false, days: 0, balanceAfter: 0, reason: "Choose a valid date range." };
  }

  const policy = LEAVE_POLICY[leaveType];
  if (!policy) {
    return { allowed: false, days, balanceAfter: 0, reason: "Unsupported leave type." };
  }

  if (policy.unpaid) {
    return { allowed: true, days, balanceAfter: 0, reason: "" };
  }

  const isProbationer = employmentStatus === "Probationer";
  if (isProbationer && policy.probationerAllowed === false) {
    return {
      allowed: false,
      days,
      balanceAfter: Number(balances[leaveType] ?? 0),
      reason: `${leaveType} leave is not accrued during probation.`,
    };
  }

  if (leaveType === "Maternity" && joiningDate) {
    const joined = Date.parse(`${joiningDate}T12:00:00`);
    const start = Date.parse(`${startDate}T12:00:00`);
    const serviceDays = Number.isFinite(joined) ? Math.floor((start - joined) / 86400000) : 0;
    if (serviceDays < policy.eligibleAfterDays) {
      return {
        allowed: false,
        days,
        balanceAfter: Number(balances[leaveType] ?? 0),
        reason: "Maternity leave requires at least 80 days of service.",
      };
    }
  }

  const maxAtOnce = isProbationer
    ? policy.probationerMaxAtOnce || policy.maxAtOnce
    : policy.maxAtOnce;
  if (maxAtOnce && days > maxAtOnce) {
    return {
      allowed: false,
      days,
      balanceAfter: Number(balances[leaveType] ?? 0),
      reason: `${leaveType} leave is limited to ${maxAtOnce} days at once.`,
    };
  }

  const available = Number(
    balances[leaveType] ?? defaultLeaveEntitlement(leaveType, employmentStatus, startDate),
  );
  if (available < days) {
    return {
      allowed: false,
      days,
      balanceAfter: available,
      reason: `Insufficient ${leaveType} leave balance.`,
    };
  }

  return {
    allowed: true,
    days,
    balanceAfter: available - days,
    reason: "",
  };
}
