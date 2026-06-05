const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DISPLAY_DATE_LOCALE = "en-GB";
const DISPLAY_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

function formatIsoDay(isoDay: string) {
  const [year, month, day] = isoDay.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(
    DISPLAY_DATE_LOCALE,
    DISPLAY_DATE_OPTIONS,
  );
}

export function formatDisplayDate(value?: string | number | null) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toLocaleDateString(DISPLAY_DATE_LOCALE, DISPLAY_DATE_OPTIONS);
  }
  const text = String(value).trim();
  if (!text) return "";
  if (DATE_ONLY_RE.test(text)) return formatIsoDay(text);
  const isoPrefix = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return formatIsoDay(isoPrefix[1]);
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return text;
  return new Date(parsed).toLocaleDateString(DISPLAY_DATE_LOCALE, DISPLAY_DATE_OPTIONS);
}
