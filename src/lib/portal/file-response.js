import { NextResponse } from "next/server";

const DEFAULT_FILE_NAME = "download";
const DEFAULT_MIME_TYPE = "application/octet-stream";

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

export function portalFileResponse(file, options = {}) {
  if (!file?.base64 && !file?.bytes) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const body = file.bytes ? Buffer.from(file.bytes) : Buffer.from(file.base64, "base64");
  const mimeType = file.mimeType || DEFAULT_MIME_TYPE;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": contentDisposition(file.fileName, options.disposition),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
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
