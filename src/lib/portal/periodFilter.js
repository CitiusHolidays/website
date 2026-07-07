import { getDateRangeError } from "@/lib/portal/dateValidation";

/** @typedef {{ from: string | null, to: string | null }} PortalDateRange */

export const EMPTY_DATE_RANGE = { from: null, to: null };

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseRowDate(value) {
  if (value == null || value === "") {
    return Number.NaN;
  }
  if (typeof value === "number") {
    return value;
  }
  const text = String(value).trim();
  if (DATE_ONLY_RE.test(text)) {
    return new Date(`${text}T00:00:00`).getTime();
  }
  return Date.parse(text);
}

export function parseDateOnly(value) {
  if (!value?.trim()) {
    return null;
  }
  const text = value.trim();
  if (!DATE_ONLY_RE.test(text)) {
    return null;
  }
  return new Date(`${text}T00:00:00`).getTime();
}

export function endOfDateOnly(value) {
  const start = parseDateOnly(value);
  if (start == null) {
    return null;
  }
  return start + 24 * 60 * 60 * 1000 - 1;
}

export function normalizeDateRange(range) {
  const from = range?.from?.trim() || null;
  const to = range?.to?.trim() || null;
  if (!(from || to)) {
    return EMPTY_DATE_RANGE;
  }
  return { from, to };
}

export function getFilterDateRangeError(range) {
  const normalized = normalizeDateRange(range);
  return getDateRangeError(normalized.from, normalized.to, {
    endLabel: "To",
    startLabel: "From",
  });
}

export function isValidDateRange(range) {
  return getFilterDateRangeError(range) == null;
}

export function resolveDateRange(range) {
  const normalized = normalizeDateRange(range);
  if (getFilterDateRangeError(normalized)) {
    return null;
  }
  const sinceMs = parseDateOnly(normalized.from);
  const untilMs = endOfDateOnly(normalized.to);
  if (sinceMs == null && untilMs == null) {
    return null;
  }
  return {
    sinceMs: sinceMs ?? 0,
    untilMs: untilMs ?? Date.now(),
  };
}

export function isInDateRange(value, range) {
  const resolved = resolveDateRange(range);
  if (!resolved) {
    return true;
  }
  const ms = parseRowDate(value);
  if (!Number.isFinite(ms)) {
    return false;
  }
  return ms >= resolved.sinceMs && ms <= resolved.untilMs;
}

export function filterByDateRange(rows, range, dateKey = "createdAt") {
  const resolved = resolveDateRange(range);
  if (!(resolved && rows?.length)) {
    return rows || [];
  }
  return rows.filter((row) => {
    const ms = parseRowDate(row[dateKey]);
    if (!Number.isFinite(ms)) {
      return false;
    }
    return ms >= resolved.sinceMs && ms <= resolved.untilMs;
  });
}

/** @deprecated Use filterByDateRange */
export function filterByPeriod(rows, range, dateKey = "createdAt") {
  return filterByDateRange(rows, range, dateKey);
}

/** @deprecated Use isInDateRange */
export function isInPeriod(value, range) {
  return isInDateRange(value, range);
}

/** @deprecated Use resolveDateRange */
export function resolvePeriodRange(range) {
  return resolveDateRange(range);
}

export function dateRangeQueryArg(range) {
  const normalized = normalizeDateRange(range);
  if (!(normalized.from || normalized.to)) {
    return;
  }
  if (getFilterDateRangeError(normalized)) {
    return;
  }
  return {
    from: normalized.from ?? undefined,
    to: normalized.to ?? undefined,
  };
}
