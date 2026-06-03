import { EMPTY_DATE_RANGE, normalizeDateRange } from "@/lib/portal/periodFilter";

export function formatMoney(value) {
  return `INR ${Number(value || 0).toLocaleString("en-IN")}`;
}

/** @param {{ from: string | null, to: string | null }} dateRange */
export function formatPeriodLabel(dateRange) {
  const { from, to } = normalizeDateRange(dateRange || EMPTY_DATE_RANGE);
  if (!from && !to) return "All time";
  if (from && to) return `${from} – ${to}`;
  if (from) return `From ${from}`;
  return `Until ${to}`;
}

export function formatDataAsOf(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return null;
  }
}

export function isSummaryStale(iso, staleMinutes = 5) {
  if (!iso) return false;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms > staleMinutes * 60 * 1000;
}
