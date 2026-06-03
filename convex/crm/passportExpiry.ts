import { decryptPassportPayloadJson } from "../lib/passportPayloadCrypto";

/** Strip encrypted passport sentinel values for display/export. */
export function cleanPassportField(value?: string | null) {
  const text = String(value ?? "").trim();
  return text && text.toUpperCase() !== "UNKNOWN" ? text : "";
}

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

/** Resolve expiry from plain column and/or decrypted passport JSON (export parity). */
export function passportExpiryFromDecrypted(
  plainExpiry?: string | null,
  decrypted?: { expiryDate?: string } | null,
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

/** Best-effort decrypt in query runtime; prefer passportActions.getTravellerPassportExpiryDates. */
export async function resolvePassportExpiryForList(
  plainExpiry?: string | null,
  encryptedPayload?: string | null,
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
