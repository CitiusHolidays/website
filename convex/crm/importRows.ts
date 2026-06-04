"use node";

import { encryptPassportDetails, hash } from "../lib/encryption";
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
  right: Record<string, number>,
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
        clean(passport?.expiryDate),
    );

    return {
      ...rest,
      passportNumberHash,
      encryptedPassportPayload: hasPassportDetails
        ? encryptPassportDetails({
            number: passportNumber || "UNKNOWN",
            dateOfBirth: clean(passport?.dateOfBirth) || "UNKNOWN",
            issueDate: clean(passport?.issueDate),
            expiryDate: clean(passport?.expiryDate) || "UNKNOWN",
            nationality: clean(passport?.nationality) || "UNKNOWN",
          })
        : undefined,
      passportLastFour: passportNumber ? passportNumber.slice(-4) : undefined,
      passportExpiryDate: normalizePassportExpiryDate(clean(passport?.expiryDate)),
    };
  });
}
