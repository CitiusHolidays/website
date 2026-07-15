"use node";

import { encryptPassportDetails, hash } from "../lib/encryption";
import { resolveRoomCategory } from "../lib/roomTypes";
import { normalizePassportExpiryDate } from "./passportExpiry";

export {
  exportKindValidator,
  internalPassengerImportRow,
  publicPassengerImportRow,
} from "./importRowValidators";

export const IMPORT_BATCH_SIZE = 50;

export function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

export function mergeRoomSummaries(
  left: Record<string, number>,
  right: Record<string, number>
): Record<string, number> {
  const merged = { ...left };
  for (const [roomType, count] of Object.entries(right)) {
    merged[roomType] = (merged[roomType] ?? 0) + count;
  }
  return merged;
}

function clean(value?: string) {
  return String(value ?? "").trim();
}

export function preparePassengerRows(rows: Array<any>) {
  return rows.map((row) => {
    const { passport, sourceStatus, ...rest } = row;
    const passportNumber = clean(passport?.number);
    const passportNumberHash = passportNumber ? hash(passportNumber.toUpperCase()) : undefined;
    const hasPassportDetails = Boolean(
      passportNumber ||
        clean(passport?.dateOfBirth) ||
        clean(passport?.issueDate) ||
        clean(passport?.expiryDate) ||
        clean(passport?.nationality)
    );
    const normalizedPassport = hasPassportDetails
      ? {
          dateOfBirth: clean(passport?.dateOfBirth) || "UNKNOWN",
          expiryDate: clean(passport?.expiryDate) || "UNKNOWN",
          issueDate: clean(passport?.issueDate),
          nationality: clean(passport?.nationality) || "UNKNOWN",
          number: passportNumber || "UNKNOWN",
        }
      : null;

    const roomType = row.roomType === undefined ? undefined : resolveRoomCategory(row.roomType);
    if (row.roomType !== undefined && !roomType) {
      throw new Error(
        `Unsupported room type for ${row.sourceSheet}:${row.sourceRowNumber}; use Single, Twin, Double, Triple, Child with Bed, or Family Room`
      );
    }
    const normalizedGender =
      row.gender === "M" || row.gender === "male"
        ? "Male"
        : row.gender === "F" || row.gender === "female"
          ? "Female"
          : row.gender;

    return {
      ...rest,
      encryptedPassportPayload: normalizedPassport
        ? encryptPassportDetails(normalizedPassport)
        : undefined,
      gender: normalizedGender,
      passportContentFingerprint: normalizedPassport
        ? hash(JSON.stringify(normalizedPassport))
        : undefined,
      passportExpiryDate: normalizePassportExpiryDate(clean(passport?.expiryDate)),
      passportLastFour: passportNumber ? passportNumber.slice(-4) : undefined,
      passportNumberHash,
      roomType,
    };
  });
}
