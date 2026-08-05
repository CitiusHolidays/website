import { describe, expect, test } from "bun:test";
import {
  isAllowedAttachmentMimeType,
  isExactAttachmentSize,
  MAX_ATTACHMENT_BYTES,
  normalizeMimeType,
  resolveStorageMimeType,
  storageMimeTypeMatchesClaim,
} from "./fileValidation";

const ALLOWED = ["application/pdf", "image/", "text/plain"];

describe("attachment byte and MIME validation", () => {
  test("normalizes MIME parameters and rejects active document types", () => {
    expect(normalizeMimeType(" Application/PDF; charset=binary ")).toBe("application/pdf");
    expect(isAllowedAttachmentMimeType("application/pdf; charset=binary", ALLOWED)).toBe(true);
    expect(isAllowedAttachmentMimeType("image/svg+xml", ALLOWED)).toBe(false);
    expect(isAllowedAttachmentMimeType("text/html", ALLOWED)).toBe(false);
  });

  test("uses storage metadata when present and detects a declared type mismatch", () => {
    expect(resolveStorageMimeType("image/png", "image/png")).toBe("image/png");
    expect(resolveStorageMimeType("", "application/pdf")).toBe("application/pdf");
    expect(storageMimeTypeMatchesClaim("image/png", "image/png")).toBe(true);
    expect(storageMimeTypeMatchesClaim("image/png", "image/jpeg")).toBe(false);
  });

  test("requires an exact, bounded byte count", () => {
    expect(isExactAttachmentSize(1, 1)).toBe(true);
    expect(isExactAttachmentSize(MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_BYTES)).toBe(true);
    expect(isExactAttachmentSize(MAX_ATTACHMENT_BYTES + 1, MAX_ATTACHMENT_BYTES + 1)).toBe(false);
    expect(isExactAttachmentSize(10, 9)).toBe(false);
    expect(isExactAttachmentSize(Number.NaN, 1)).toBe(false);
  });
});
