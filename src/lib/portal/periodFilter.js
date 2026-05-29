export const PORTAL_PERIOD_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "week", label: "Last week" },
  { value: "month", label: "Last month" },
  { value: "3months", label: "Last 3 months" },
  { value: "6months", label: "Last 6 months" },
  { value: "year", label: "Last year" },
];

const PERIOD_MS = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  "3months": 90 * 24 * 60 * 60 * 1000,
  "6months": 180 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

export function resolvePeriodRange(period) {
  if (!period || period === "all") return null;
  const windowMs = PERIOD_MS[period];
  if (!windowMs) return null;
  const untilMs = Date.now();
  return { sinceMs: untilMs - windowMs, untilMs };
}

export function parseRowDate(value) {
  if (value == null || value === "") return Number.NaN;
  if (typeof value === "number") return value;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00`).getTime();
  }
  return Date.parse(text);
}

export function isInPeriod(value, period) {
  const range = resolvePeriodRange(period);
  if (!range) return true;
  const ms = parseRowDate(value);
  if (!Number.isFinite(ms)) return false;
  return ms >= range.sinceMs && ms <= range.untilMs;
}

export function filterByPeriod(rows, period, dateKey = "createdAt") {
  const range = resolvePeriodRange(period);
  if (!range || !rows?.length) return rows || [];
  return rows.filter((row) => {
    const ms = parseRowDate(row[dateKey]);
    if (!Number.isFinite(ms)) return false;
    return ms >= range.sinceMs && ms <= range.untilMs;
  });
}
