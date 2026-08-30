"use node";

import { createHash } from "node:crypto";

export const MAX_PASSPORT_UPLOAD_BYTES = 15 * 1024 * 1024;

export type PassportUploadFailureCode =
  | "active_content"
  | "invalid_size"
  | "mime_mismatch"
  | "password_protected"
  | "storage_missing"
  | "unsupported_signature";

type PassportUploadValidationResult =
  | {
      contentDigest: string;
      mimeType: "application/pdf" | "image/jpeg" | "image/png";
      ok: true;
    }
  | { code: PassportUploadFailureCode; ok: false };

const PDF_ACTIVE_TOKENS = [
  "/AcroForm",
  "/EmbeddedFile",
  "/JavaScript",
  "/JS",
  "/Launch",
  "/OpenAction",
  "/RichMedia",
] as const;
const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_IEND = Uint8Array.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

function startsWith(bytes: Uint8Array, signature: Uint8Array) {
  return (
    bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value)
  );
}

function endsWith(bytes: Uint8Array, signature: Uint8Array) {
  if (bytes.length < signature.length) {
    return false;
  }
  const offset = bytes.length - signature.length;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function normalizedMimeType(value: string) {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function validatePdf(bytes: Uint8Array): PassportUploadValidationResult {
  const source = new TextDecoder("latin1").decode(bytes);
  if (!source.startsWith("%PDF-")) {
    return { code: "unsupported_signature", ok: false };
  }
  const eofIndex = source.lastIndexOf("%%EOF");
  if (eofIndex < 0 || source.slice(eofIndex + 5).trim().length > 0) {
    return { code: "unsupported_signature", ok: false };
  }
  if (source.includes("/Encrypt")) {
    return { code: "password_protected", ok: false };
  }
  if (PDF_ACTIVE_TOKENS.some((token) => source.includes(token))) {
    return { code: "active_content", ok: false };
  }
  return {
    contentDigest: createHash("sha256").update(bytes).digest("hex"),
    mimeType: "application/pdf",
    ok: true,
  };
}

function validateJpeg(bytes: Uint8Array): PassportUploadValidationResult {
  const trailer = bytes.slice(-2);
  if (
    bytes.length < 5 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff ||
    trailer[0] !== 0xff ||
    trailer[1] !== 0xd9
  ) {
    return { code: "unsupported_signature", ok: false };
  }
  return {
    contentDigest: createHash("sha256").update(bytes).digest("hex"),
    mimeType: "image/jpeg",
    ok: true,
  };
}

function validatePng(bytes: Uint8Array): PassportUploadValidationResult {
  if (!(startsWith(bytes, PNG_SIGNATURE) && endsWith(bytes, PNG_IEND))) {
    return { code: "unsupported_signature", ok: false };
  }
  return {
    contentDigest: createHash("sha256").update(bytes).digest("hex"),
    mimeType: "image/png",
    ok: true,
  };
}

/**
 * Conservative server-side validation for the supported passport formats.
 * This is a content gate, not a claim that an external malware scanner ran.
 * The Customer Document Intake launch remains blocked by ADR 0012 until a
 * security owner accepts a scanner and its failure/recovery runbook.
 */
export function validatePassportUpload(
  bytes: Uint8Array,
  input: { claimedMimeType: string; claimedSize?: number }
): PassportUploadValidationResult {
  if (
    bytes.byteLength < 1 ||
    bytes.byteLength > MAX_PASSPORT_UPLOAD_BYTES ||
    input.claimedSize !== bytes.byteLength
  ) {
    return { code: "invalid_size", ok: false };
  }

  let validation: PassportUploadValidationResult;
  if (startsWith(bytes, PNG_SIGNATURE)) {
    validation = validatePng(bytes);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    validation = validateJpeg(bytes);
  } else {
    validation = validatePdf(bytes);
  }
  if (!validation.ok) {
    return validation;
  }
  if (normalizedMimeType(input.claimedMimeType) !== validation.mimeType) {
    return { code: "mime_mismatch", ok: false };
  }
  return validation;
}
