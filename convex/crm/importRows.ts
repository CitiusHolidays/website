"use node";

import type { Infer } from "convex/values";
import { encryptPassportDetails, hash } from "../lib/encryption";
import { resolveRoomCategory } from "../lib/roomTypes";
import { PASSENGER_IMPORT_BATCH_SIZE } from "./importBatchPolicy";
import {
  exportKindValidator as exportKindValidatorDefinition,
  internalPassengerImportRow as internalPassengerImportRowDefinition,
  publicPassengerImportRow as publicPassengerImportRowDefinition,
} from "./importRowValidators";
import { normalizePassportExpiryDate } from "./passportExpiry";

export const exportKindValidator = exportKindValidatorDefinition;
export const internalPassengerImportRow = internalPassengerImportRowDefinition;
export const publicPassengerImportRow = publicPassengerImportRowDefinition;

export type InternalPassengerImportRow = Infer<typeof internalPassengerImportRow>;
export type PublicPassengerImportRow = Infer<typeof publicPassengerImportRow>;

export const IMPORT_BATCH_SIZE = PASSENGER_IMPORT_BATCH_SIZE;

export interface RoomSummary {
  [roomType: string]: number;
}

export function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

export function mergeRoomSummaries(left: RoomSummary, right: RoomSummary): RoomSummary {
  const merged = { ...left };
  for (const [roomType, count] of Object.entries(right)) {
    merged[roomType] = (merged[roomType] ?? 0) + count;
  }
  return merged;
}

function clean(value?: string) {
  return String(value ?? "").trim();
}

function normalizePassengerGender(gender: PublicPassengerImportRow["gender"]) {
  if (gender === "M" || gender === "male") {
    return "Male" as const;
  }
  if (gender === "F" || gender === "female") {
    return "Female" as const;
  }
  return gender;
}

function normalizePassport(passport: PublicPassengerImportRow["passport"], passportNumber: string) {
  const hasPassportDetails = Boolean(
    passportNumber ||
      clean(passport?.dateOfBirth) ||
      clean(passport?.issueDate) ||
      clean(passport?.expiryDate) ||
      clean(passport?.nationality)
  );
  if (!hasPassportDetails) {
    return null;
  }
  return {
    dateOfBirth: clean(passport?.dateOfBirth) || "UNKNOWN",
    expiryDate: clean(passport?.expiryDate) || "UNKNOWN",
    issueDate: clean(passport?.issueDate),
    nationality: clean(passport?.nationality) || "UNKNOWN",
    number: passportNumber || "UNKNOWN",
  };
}

export function preparePassengerRows(
  rows: PublicPassengerImportRow[]
): InternalPassengerImportRow[] {
  return rows.map((row) => {
    const { passport, sourceStatus: _sourceStatus, ...rest } = row;
    const passportNumber = clean(passport?.number);
    const passportNumberHash = passportNumber ? hash(passportNumber.toUpperCase()) : undefined;
    const normalizedPassport = normalizePassport(passport, passportNumber);

    const roomType = row.roomType === undefined ? undefined : resolveRoomCategory(row.roomType);
    if (row.roomType !== undefined && !roomType) {
      throw new Error(
        `Unsupported room type for ${row.sourceSheet}:${row.sourceRowNumber}; use Single, Twin, Double, Triple, Child with Bed, or Family Room`
      );
    }
    const normalizedGender = normalizePassengerGender(row.gender);

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
      // SAFETY: roomType is selected from the canonical room-type aliases immediately above.
      roomType: roomType as InternalPassengerImportRow["roomType"],
    };
  });
}
