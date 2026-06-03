/** Normalize spreadsheet or form expiry values to YYYY-MM-DD for list display. */
export function normalizePassportExpiryDate(value?: string | null) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed.toUpperCase() === "UNKNOWN") {
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString().slice(0, 10);
}
