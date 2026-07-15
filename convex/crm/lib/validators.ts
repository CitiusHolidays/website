import { ConvexError, v } from "convex/values";

export const MAX_QUERY_NOTES_WORDS = 30;

export function countWords(value: string | undefined | null) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

export function assertMaxWordCount(
  value: string | undefined,
  maxWords: number,
  fieldLabel: string
) {
  if (value === undefined) {
    return;
  }
  const wordCount = countWords(value);
  if (wordCount > maxWords) {
    throw new ConvexError(`${fieldLabel} must be ${maxWords} words or fewer`);
  }
}

export function assertDateRangeOrder(
  startDate: string | undefined | null,
  endDate: string | undefined | null,
  startLabel: string,
  endLabel: string
) {
  const start = startDate?.trim();
  const end = endDate?.trim();
  if (!(start && end)) {
    return;
  }
  if (start > end) {
    throw new ConvexError(`${startLabel} must be on or before ${endLabel}.`);
  }
}

export const portalDateRangeValidator = v.optional(
  v.object({
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  })
);

export type PortalDateRange = {
  from?: string;
  to?: string;
};

const PORTAL_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePortalDateOnly(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }
  const text = value.trim();
  if (!PORTAL_DATE_ONLY_RE.test(text)) {
    return null;
  }
  return new Date(`${text}T00:00:00`).getTime();
}

export function endOfPortalDateOnly(value: string | undefined): number | null {
  const start = parsePortalDateOnly(value);
  if (start == null) {
    return null;
  }
  return start + 24 * 60 * 60 * 1000 - 1;
}

export function resolvePortalDateRange(range?: PortalDateRange | null) {
  if (!range) {
    return null;
  }
  const sinceMs = parsePortalDateOnly(range.from);
  const untilMs = endOfPortalDateOnly(range.to);
  if (sinceMs == null && untilMs == null) {
    return null;
  }
  return {
    sinceMs: sinceMs ?? 0,
    untilMs: untilMs ?? Date.now(),
  };
}

export function filterRecordsByDateRange<T extends { createdAt: number }>(
  records: T[],
  range?: PortalDateRange | null
) {
  const resolved = resolvePortalDateRange(range);
  if (!resolved) {
    return records;
  }
  return records.filter(
    (record) => record.createdAt >= resolved.sinceMs && record.createdAt <= resolved.untilMs
  );
}
