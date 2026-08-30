import { describe, expect, test } from "bun:test";
import { validatePassportUpload } from "./passportUploadValidation";

const encode = (value: string) => new TextEncoder().encode(value);

function validatePdf(source: string, claimedMimeType = "application/pdf") {
  const bytes = encode(source);
  return validatePassportUpload(bytes, { claimedMimeType, claimedSize: bytes.byteLength });
}

describe("passport upload content validation", () => {
  test("accepts signature-matched PDF, JPEG, and PNG bytes", () => {
    const pdf = validatePdf("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
    expect(pdf).toMatchObject({ mimeType: "application/pdf", ok: true });

    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0xff, 0xd9]);
    expect(
      validatePassportUpload(jpeg, {
        claimedMimeType: "image/jpeg",
        claimedSize: jpeg.byteLength,
      })
    ).toMatchObject({ mimeType: "image/jpeg", ok: true });

    const png = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]);
    expect(
      validatePassportUpload(png, {
        claimedMimeType: "image/png",
        claimedSize: png.byteLength,
      })
    ).toMatchObject({ mimeType: "image/png", ok: true });
  });

  test("rejects MIME spoofing and claimed-size drift", () => {
    expect(validatePdf("%PDF-1.7\n%%EOF", "image/png")).toEqual({
      code: "mime_mismatch",
      ok: false,
    });
    const bytes = encode("%PDF-1.7\n%%EOF");
    expect(
      validatePassportUpload(bytes, {
        claimedMimeType: "application/pdf",
        claimedSize: bytes.byteLength + 1,
      })
    ).toEqual({ code: "invalid_size", ok: false });
  });

  test("fails closed on active, encrypted, malformed, and appended PDF payloads", () => {
    expect(validatePdf("%PDF-1.7\n/OpenAction 2 0 R\n%%EOF")).toEqual({
      code: "active_content",
      ok: false,
    });
    expect(validatePdf("%PDF-1.7\n/Encrypt 2 0 R\n%%EOF")).toEqual({
      code: "password_protected",
      ok: false,
    });
    expect(validatePdf("%PDF-1.7\nno eof")).toEqual({
      code: "unsupported_signature",
      ok: false,
    });
    expect(validatePdf("%PDF-1.7\n%%EOF\nPK\u0003\u0004")).toEqual({
      code: "unsupported_signature",
      ok: false,
    });
  });
});
