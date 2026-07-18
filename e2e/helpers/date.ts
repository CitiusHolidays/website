import type { Locator } from "@playwright/test";

/** ISO `YYYY-MM-DD` for a date offset from today. */
export function isoDate(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().slice(0, 10);
}

/** Portal `PortalDateInput` display format (DD/MM/YYYY). */
export function portalDisplayDateFromIso(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Fill a portal date field and commit the ISO value on blur. */
export async function fillPortalDate(field: Locator, iso: string) {
  await field.fill(portalDisplayDateFromIso(iso));
  await field.blur();
}
