import { isRuntimeObject, isRuntimeString, type RuntimeValue } from "./runtimeValues";

export const MAX_BOOKING_NOTES_CHARACTERS = 5000;
export const MAX_BOOKING_TRAVELER_NAME_CHARACTERS = 200;
export const MAX_BOOKING_DETAILS_BYTES = 12 * 1024;

export interface BookingTravelerDetail {
  fullName: string;
  [key: string]: string;
}

type BookingDetailsResult =
  | { ok: false }
  | { notes: string; ok: true; travelerDetails: BookingTravelerDetail[] | null };

export function parseBookingDetails(
  notes: RuntimeValue,
  travelerDetails: RuntimeValue,
  travelers: number
): BookingDetailsResult {
  if (!(isRuntimeString(notes) && notes.length <= MAX_BOOKING_NOTES_CHARACTERS)) {
    return { ok: false };
  }
  const details = travelerDetails === null ? [] : travelerDetails;
  if (!Array.isArray(details) || details.length > travelers) {
    return { ok: false };
  }

  const normalized: BookingTravelerDetail[] = [];
  for (const detail of details) {
    if (
      !isRuntimeObject(detail) ||
      detail === null ||
      Array.isArray(detail) ||
      Object.keys(detail).length !== 1 ||
      !("fullName" in detail) ||
      !isRuntimeString(detail.fullName)
    ) {
      return { ok: false };
    }
    const fullName = detail.fullName.trim();
    if (!(fullName && fullName.length <= MAX_BOOKING_TRAVELER_NAME_CHARACTERS)) {
      return { ok: false };
    }
    normalized.push({ fullName });
  }

  const normalizedDetails = normalized.length > 0 ? normalized : null;
  const serialized = JSON.stringify({ notes, travelerDetails: normalizedDetails });
  if (new TextEncoder().encode(serialized).byteLength > MAX_BOOKING_DETAILS_BYTES) {
    return { ok: false };
  }
  return { notes, ok: true, travelerDetails: normalizedDetails };
}
