/** Day/month/year display (DD/MM/YYYY) for portal and site UI. */
export const DISPLAY_DATE_LOCALE = "en-GB";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const DISPLAY_DATE_OPTIONS = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

function formatCalendarDate(year, monthIndex, day) {
  return new Date(year, monthIndex, day).toLocaleDateString(
    DISPLAY_DATE_LOCALE,
    DISPLAY_DATE_OPTIONS
  );
}

function formatIsoDay(isoDay) {
  const [year, month, day] = isoDay.split("-").map(Number);
  return formatCalendarDate(year, month - 1, day);
}

function parseDisplayDate(value) {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toLocaleDateString(DISPLAY_DATE_LOCALE, DISPLAY_DATE_OPTIONS);
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (DATE_ONLY_RE.test(text)) {
    return formatIsoDay(text);
  }
  const isoPrefix = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) {
    return formatIsoDay(isoPrefix[1]);
  }
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    return text;
  }
  return new Date(parsed).toLocaleDateString(DISPLAY_DATE_LOCALE, DISPLAY_DATE_OPTIONS);
}

/** Format a date for UI; returns "-" when empty or unparseable. */
export function formatDisplayDate(value) {
  return parseDisplayDate(value) ?? "-";
}

/** Format a timestamp with time (DD/MM/YYYY, hh:mm). */
export function formatDisplayDateTime(value) {
  if (value == null || value === "") {
    return "-";
  }
  const parsed =
    typeof value === "number" && Number.isFinite(value) ? value : Date.parse(String(value).trim());
  if (Number.isNaN(parsed)) {
    return String(value);
  }
  return new Date(parsed).toLocaleString(DISPLAY_DATE_LOCALE, {
    ...DISPLAY_DATE_OPTIONS,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Spreadsheet cells: empty string when missing. */
export function formatDisplayDateForExport(value) {
  return parseDisplayDate(value) ?? "";
}

const DISPLAY_DMY_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/;

/** ISO `YYYY-MM-DD` for form state and filters; null when empty or invalid. */
export function isoDayFromDisplayDate(value) {
  if (value == null || value === "") {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (DATE_ONLY_RE.test(text)) {
    return text;
  }
  const match = text.match(DISPLAY_DMY_RE);
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) {
    year += 2000;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

/** `DD/MM/YYYY` text for date inputs from stored ISO day. */
export function displayDateFromIsoDay(iso) {
  if (iso == null || iso === "") {
    return "";
  }
  const text = String(iso).trim();
  if (!DATE_ONLY_RE.test(text)) {
    return "";
  }
  const [year, month, day] = text.split("-").map(Number);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/** Strip to digits and insert `/` as DD/MM/YYYY while typing. */
export function formatDisplayDateInputDigits(digits) {
  const clean = String(digits).replace(/\D/g, "").slice(0, 8);
  if (clean.length <= 2) {
    return clean;
  }
  if (clean.length <= 4) {
    return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  }
  return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4)}`;
}
