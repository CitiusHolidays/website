import { decryptPassportPayloadJson } from "../lib/passportPayloadCrypto";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SIX_MONTHS_MS = 183 * MS_PER_DAY;

export type PassportExpiryUrgency = "critical" | "expired" | "ok" | "unknown" | "warning";

function dateOnlyAtNoon(value?: string | null) {
  const normalized = normalizePassportExpiryDate(value);
  if (!normalized) {
    return null;
  }
  const parsed = Date.parse(`${normalized}T12:00:00.000Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

export function classifyPassportExpiryUrgency({
  expiryDate,
  referenceDate,
  travelDate,
}: {
  expiryDate?: string | null;
  referenceDate: string;
  travelDate?: string | null;
}): PassportExpiryUrgency {
  const expiryMs = dateOnlyAtNoon(expiryDate);
  const referenceMs = dateOnlyAtNoon(referenceDate);
  const travelMs = dateOnlyAtNoon(travelDate);
  if (expiryMs === null || referenceMs === null) {
    return "unknown";
  }
  if (expiryMs < referenceMs) {
    return "expired";
  }
  if (travelMs !== null && (expiryMs < travelMs + SIX_MONTHS_MS || expiryMs <= travelMs)) {
    return "critical";
  }
  if (expiryMs <= referenceMs + SIX_MONTHS_MS) {
    return "warning";
  }
  return "ok";
}

/** Strip encrypted passport sentinel values for display/export. */
export function cleanPassportField(value?: string | null) {
  const text = String(value ?? "").trim();
  return text && text.toUpperCase() !== "UNKNOWN" ? text : "";
}

/** Normalize spreadsheet or form expiry values to YYYY-MM-DD for list display. */
export function normalizePassportExpiryDate(value?: string | null) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed.toUpperCase() === "UNKNOWN") {
    return;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return;
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

/** Resolve expiry from plain column and/or decrypted passport JSON (export parity). */
export function passportExpiryFromDecrypted(
  plainExpiry?: string | null,
  decrypted?: { expiryDate?: string } | null
): string {
  const fromPlain = normalizePassportExpiryDate(plainExpiry);
  if (fromPlain) {
    return fromPlain;
  }
  if (!decrypted) {
    return "";
  }
  return normalizePassportExpiryDate(cleanPassportField(decrypted.expiryDate)) ?? "";
}

/** Best-effort decrypt for bounded internal backfill jobs. Portal lists use the denormalized date. */
export async function resolvePassportExpiryForList(
  plainExpiry?: string | null,
  encryptedPayload?: string | null
): Promise<string> {
  const fromPlain = normalizePassportExpiryDate(plainExpiry);
  if (fromPlain) {
    return fromPlain;
  }
  if (!encryptedPayload) {
    return "";
  }

  const decrypted = await decryptPassportPayloadJson(encryptedPayload);
  return passportExpiryFromDecrypted(plainExpiry, decrypted);
}
