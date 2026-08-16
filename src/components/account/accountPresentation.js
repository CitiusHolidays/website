import { isRuntimeNumber, isRuntimeString } from "../../lib/runtimeValues";

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const ACCOUNT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];

function parseAccountDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (isRuntimeNumber(value) && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const dateOnly = text.match(DATE_ONLY_RE);
  const date = dateOnly ? new Date(`${dateOnly[0]}T12:00:00`) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAccountDate(value) {
  const date = parseAccountDate(value);
  if (!date) {
    return "Date to follow";
  }

  return `${date.getDate()} ${ACCOUNT_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatAccountDateRange(start, end) {
  const startLabel = formatAccountDate(start);
  const endLabel = formatAccountDate(end);
  if (startLabel === "Date to follow" && endLabel === "Date to follow") {
    return "Dates to follow";
  }
  if (endLabel === "Date to follow" || startLabel === endLabel) {
    return startLabel;
  }
  if (startLabel === "Date to follow") {
    return endLabel;
  }
  return `${startLabel} – ${endLabel}`;
}

export function getTripNights(trip) {
  const start = parseAccountDate(trip?.startDate);
  const end = parseAccountDate(trip?.endDate);
  if (!(start && end) || end < start) {
    return null;
  }

  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

export function getDepartureLabel(startDate, now = Date.now()) {
  const start = parseAccountDate(startDate);
  if (!start) {
    return "Dates to follow";
  }

  const daysUntilDeparture = Math.ceil((start.getTime() - now) / 86_400_000);
  if (daysUntilDeparture <= 0) {
    return "Journey in progress";
  }
  if (daysUntilDeparture === 1) {
    return "Departs tomorrow";
  }
  return `Departs in ${daysUntilDeparture} days`;
}

export function getTripDestination(trip) {
  const destination = [trip?.destination, trip?.location, trip?.region].find(
    (value) => isRuntimeString(value) && value.trim()
  );
  if (destination) {
    return destination.trim();
  }

  return isRuntimeString(trip?.name) && trip.name.trim()
    ? trip.name.trim()
    : "Destination details to follow";
}
