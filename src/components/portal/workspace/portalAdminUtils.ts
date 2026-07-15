import { LEAVE_TYPES } from "@/lib/portal/constants";
import type { PortalGridAttention } from "@/lib/portal/portalDataGrid";
import type { PortalLeaveBalanceRow } from "./portalViewTypes";

export function decisionRowAttention(status: string | undefined): PortalGridAttention | undefined {
  if (status === "Rejected") {
    return { label: "Rejected — review required", tone: "danger" };
  }
  return status === "Pending" ? { label: "Pending decision", tone: "warning" } : undefined;
}

export function leaveBalanceRowsForDisplay(leaveBalances: PortalLeaveBalanceRow[] | undefined) {
  if (!Array.isArray(leaveBalances)) {
    return null;
  }

  const rowsByType = new Map(leaveBalances.map((row) => [row.leaveType, row]));
  return LEAVE_TYPES.map((leaveType) => {
    const row = rowsByType.get(leaveType);
    if (row) {
      const availableDays = Number(row.availableDays || 0).toFixed(1);
      return {
        detail: `${row.fiscalYear || "Current year"} balance`,
        leaveType,
        value: availableDays,
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

export function filterDropdowns(dropdowns: Record<string, string[]>, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) {
    return dropdowns;
  }
  const filtered: Record<string, string[]> = {};
  for (const [category, values] of Object.entries(dropdowns)) {
    const categoryMatches = category.toLowerCase().includes(term);
    const matchedValues = values.filter((value) => value.toLowerCase().includes(term));
    if (categoryMatches || matchedValues.length > 0) {
      filtered[category] = categoryMatches ? values : matchedValues;
    }
  }
  return filtered;
}

export function onboardingActionLabel(row: { onboardingStatus?: string }) {
  if (row.onboardingStatus === "ready") {
    return "Send password reset";
  }
  if (row.onboardingStatus === "pending") {
    return "Resend verification";
  }
  return "Send verification";
}
