import { ConvexError } from "convex/values";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function assertReferenceNow(referenceNow: number) {
  if (!(Number.isFinite(referenceNow) && referenceNow >= 0 && Number.isSafeInteger(referenceNow))) {
    throw new ConvexError("A valid reference time is required");
  }
  return referenceNow;
}

export function assertReferenceDate(referenceDate: string) {
  const match = DATE_ONLY_PATTERN.exec(referenceDate);
  if (!match) {
    throw new ConvexError("A valid reference date is required");
  }
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ConvexError("A valid reference date is required");
  }
  return referenceDate;
}
