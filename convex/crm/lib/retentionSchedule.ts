import type { Doc } from "../../_generated/dataModel";
import { workDateFor } from "../officeCheckInVerification";

/**
 * Data retention schedule (director decision, 7 Nov 2026). Every period is counted in office
 * dates, India Standard Time, as field passports and office check-ins are. A record is past its
 * period when its office date is before `today - period`, so it is kept through the whole last
 * day of the period.
 *
 * Trip end, used by every trip-based rule: the Travel Batch's own dates when the batch records a
 * start date, else the Job Card's (`tripDates`, never a mix); the end date,
 * falling back to the start date. A trip with neither date is undated and nothing is purged for
 * it.
 */
export const RETENTION_PERIODS = {
  activityLogs: { days: 365 },
  bookingRecords: { years: 8 },
  feedback: { years: 3 },
  inactiveCustomerAccounts: { years: 3 },
  passportScansAfterTrip: { days: 90 },
  travellersAfterTrip: { years: 3 },
  unconvertedEnquiries: { years: 2 },
} as const;

export type RetentionPeriod = { days: number } | { years: number };

/** Field passport audit rows are kept for one year after the trip's passport window closes. */
export const FIELD_PASSPORT_AUDIT_RETENTION_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseOfficeDate(date: string | null | undefined) {
  const match = DATE_PATTERN.exec(String(date ?? "").trim());
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCMonth() === month - 1 && value.getUTCDate() === day
    ? { day, month, year }
    : null;
}

function formatUtcDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

/** Moves an office date back by a period; 29 February minus a year is 28 February. */
export function officeDateBefore(date: string, period: RetentionPeriod) {
  const parsed = parseOfficeDate(date);
  if (!parsed) {
    throw new Error(`Unexpected office date format: ${date}`);
  }
  if ("days" in period) {
    return formatUtcDate(
      new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day - period.days))
    );
  }
  const year = parsed.year - period.years;
  const lastDay = new Date(Date.UTC(year, parsed.month, 0)).getUTCDate();
  return formatUtcDate(new Date(Date.UTC(year, parsed.month - 1, Math.min(parsed.day, lastDay))));
}

/** 00:00 IST at the start of an office date, as a timestamp. */
export function officeDayStartMs(date: string) {
  const parsed = parseOfficeDate(date);
  if (!parsed) {
    throw new Error(`Unexpected office date format: ${date}`);
  }
  return Date.UTC(parsed.year, parsed.month - 1, parsed.day) - IST_OFFSET_MS;
}

export interface RetentionCutoff {
  /** Office dates before this one are past the period. */
  date: string;
  /** Timestamps before this one are past the period. */
  startMs: number;
}

export function retentionCutoff(asOf: number, period: RetentionPeriod): RetentionCutoff {
  const date = officeDateBefore(workDateFor(asOf), period);
  return { date, startMs: officeDayStartMs(date) };
}

function latestDate(dates: string[]) {
  // ISO dates sort lexically in date order.
  return dates.reduce<string | null>(
    (latest, date) => (latest && latest > date ? latest : date),
    null
  );
}

/** The batch's own date pair when it records a start date, else the Job Card's; never a mix. */
export function tripDates(job: Doc<"jobCards">, batch: Doc<"travelBatches"> | null) {
  const source = batch?.travelStartDate ? batch : job;
  return { travelEndDate: source.travelEndDate, travelStartDate: source.travelStartDate };
}

/** The trip's last day, or null when the trip records no valid date at all. */
export function tripEndDate(dates: {
  travelEndDate?: string | null;
  travelStartDate?: string | null;
}) {
  const valid = [dates.travelStartDate, dates.travelEndDate]
    .map((value) => String(value ?? "").trim())
    .filter((value) => parseOfficeDate(value) !== null);
  // A start after the end is bad data; the later date keeps the record longer.
  return latestDate(valid);
}

/**
 * The end of a whole Job Card: the latest end across the Job Card's own dates and every Travel
 * Batch. Null when any batch, or the Job Card without batches, is undated.
 */
export function jobCardTripEndDate(job: Doc<"jobCards">, batches: Doc<"travelBatches">[]) {
  const ends = (batches.length > 0 ? batches : [null]).map((batch) =>
    tripEndDate(tripDates(job, batch))
  );
  if (ends.some((end) => end === null)) {
    return null;
  }
  return latestDate(ends.filter((end): end is string => end !== null));
}

export type TripRetentionVerdict = "expired" | "kept_trip_recent" | "kept_undated";

export function tripRetentionVerdict(
  endDate: string | null,
  cutoff: RetentionCutoff
): TripRetentionVerdict {
  if (endDate === null) {
    return "kept_undated";
  }
  return endDate < cutoff.date ? "expired" : "kept_trip_recent";
}

export const RETENTION_DAY_MS = DAY_MS;
