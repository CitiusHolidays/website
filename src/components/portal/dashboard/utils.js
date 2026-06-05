import { formatDisplayDate, formatDisplayDateTime } from "@/lib/formatDate";
import { EMPTY_DATE_RANGE, normalizeDateRange } from "@/lib/portal/periodFilter";

export function formatMoney(value) {
  return `INR ${Number(value || 0).toLocaleString("en-IN")}`;
}

/** @param {{ from: string | null, to: string | null }} dateRange */
export function formatPeriodLabel(dateRange) {
  const { from, to } = normalizeDateRange(dateRange || EMPTY_DATE_RANGE);
  if (!from && !to) return "All time";
  if (from && to) return `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`;
  if (from) return `From ${formatDisplayDate(from)}`;
  return `Until ${formatDisplayDate(to)}`;
}

export function formatDataAsOf(iso) {
  if (!iso) return null;
  try {
    const formatted = formatDisplayDateTime(iso);
    return formatted === "-" ? null : formatted;
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

export function formatMetricTrend(trend) {
  if (!trend || trend.direction === "flat" || trend.delta === 0) {
    return "— no change";
  }
  const arrow = trend.direction === "up" ? "↑" : "↓";
  return `${arrow} ${trend.delta} vs last 30d`;
}

export function formatRelativeTime(iso) {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatOldestDays(iso) {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const days = Math.max(1, Math.floor((Date.now() - ms) / 86400000));
  return `${days}d`;
}
