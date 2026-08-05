import { NextResponse } from "next/server";

const DEFAULT_FILE_NAME = "download";
const DEFAULT_MIME_TYPE = "application/octet-stream";
const SAFE_MIME_TYPE = /^[a-z0-9!#$&^_.+*-]+\/[a-z0-9!#$&^_.+*-]+$/i;

function sanitizeFileName(fileName) {
  const cleaned = String(fileName || DEFAULT_FILE_NAME)
    .replace(/[\r\n\\"]/g, "_")
    .replace(/[^\w .,@()[\]-]/g, "_")
    .trim();
  return cleaned || DEFAULT_FILE_NAME;
}

function contentDisposition(fileName, disposition = "attachment") {
  const safeFileName = sanitizeFileName(fileName);
  return `${disposition}; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`;
}

export function sanitizeFileMimeType(mimeType) {
  const normalized = String(mimeType || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  return SAFE_MIME_TYPE.test(normalized) ? normalized : DEFAULT_MIME_TYPE;
}

export function portalFileResponse(file, options = {}) {
  if (!(file?.base64 || file?.bytes)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const body = file.bytes ? Buffer.from(file.bytes) : Buffer.from(file.base64, "base64");
  if (body.byteLength < 1) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const mimeType = sanitizeFileMimeType(file.mimeType);

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": contentDisposition(file.fileName, options.disposition),
      "Content-Length": String(body.byteLength),
      "Content-Type": mimeType,
      "X-Content-Type-Options": "nosniff",
    },
    status: 200,
  });
}

export function portalFileErrorResponse(error) {
  const message = error?.data || error?.message || "Unable to access file";
  const status =
    message === "FORBIDDEN" || message.includes("UNAUTHORIZED")
      ? 403
      : message.includes("not found") || message.includes("not available")
        ? 404
        : 500;
  return NextResponse.json({ error: message }, { status });
}
