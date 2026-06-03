const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SIX_MONTHS_MS = 183 * MS_PER_DAY;

function parseDate(value) {
  if (!value || value === "UNKNOWN") return null;
  const parsed = Date.parse(`${value}T12:00:00`);
  return Number.isNaN(parsed) ? null : parsed;
}

function startOfTodayMs(today = new Date()) {
  return Date.parse(`${today.toISOString().slice(0, 10)}T12:00:00`);
}

export function getPassportExpiryInfo({ expiryDate, travelDate, today = new Date() }) {
  const expiryMs = parseDate(expiryDate);
  const travelMs = parseDate(travelDate);
  const todayMs = startOfTodayMs(today);

  if (expiryMs === null) {
    return { level: "unknown", daysLeft: null, daysPast: null };
  }

  const daysLeft = Math.ceil((expiryMs - todayMs) / MS_PER_DAY);
  if (daysLeft < 0) {
    return { level: "expired", daysLeft, daysPast: Math.abs(daysLeft) };
  }

  if (travelMs !== null) {
    const validThroughTravel = expiryMs >= travelMs + SIX_MONTHS_MS;
    if (!validThroughTravel || expiryMs <= travelMs) {
      return { level: "critical", daysLeft, daysPast: null };
    }
  }

  const renewThreshold = todayMs + SIX_MONTHS_MS;
  if (expiryMs <= renewThreshold) {
    return { level: "warning", daysLeft, daysPast: null };
  }

  return { level: "ok", daysLeft, daysPast: null };
}

export function formatPassportExpiryLabel(info) {
  if (!info || info.level === "unknown") return "—";
  if (info.level === "expired") {
    return `Expired ${info.daysPast} day${info.daysPast === 1 ? "" : "s"} ago`;
  }
  if (info.level === "critical") {
    return `Cannot travel · ${info.daysLeft} day${info.daysLeft === 1 ? "" : "s"} left`;
  }
  if (info.level === "warning") {
    return `Renew soon · ${info.daysLeft} day${info.daysLeft === 1 ? "" : "s"} left`;
  }
  return `${info.daysLeft} day${info.daysLeft === 1 ? "" : "s"} left`;
}

export function passportExpiryTone(info) {
  if (!info) return "neutral";
  if (info.level === "expired" || info.level === "critical") return "red";
  if (info.level === "warning") return "amber";
  if (info.level === "ok") return "green";
  return "neutral";
}

export function attachPassportExpiryUrgency(rows, today = new Date()) {
  return (rows || []).map((row) => {
    const info = getPassportExpiryInfo({
      expiryDate: row.passportExpiryDate,
      travelDate: row.travelStartDate || row.travelDate,
      today,
    });
    return { ...row, _passportExpiryUrgency: info.level };
  });
}

export function filterByPassportExpiryUrgency(rows, urgency) {
  if (!urgency) return rows || [];
  return (rows || []).filter((row) => row._passportExpiryUrgency === urgency);
}

export const PASSPORT_EXPIRY_URGENCY_OPTIONS = [
  { value: "", label: "All urgency" },
  { value: "critical", label: "Cannot travel" },
  { value: "warning", label: "Renew soon" },
  { value: "ok", label: "OK" },
  { value: "expired", label: "Expired" },
  { value: "unknown", label: "Unknown" },
];
