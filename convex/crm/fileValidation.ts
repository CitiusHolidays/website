export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const MIME_TOKEN = /^[a-z0-9!#$&^_.+*-]+\/[a-z0-9!#$&^_.+*-]+$/i;
const DISALLOWED_ACTIVE_MIME_TYPES = new Set([
  "application/xhtml+xml",
  "image/svg+xml",
  "text/html",
  "text/javascript",
]);

export function normalizeMimeType(value: unknown) {
  return String(value ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

export function isAllowedAttachmentMimeType(value: unknown, allowedPrefixes: readonly string[]) {
  const normalized = normalizeMimeType(value);
  return (
    MIME_TOKEN.test(normalized) &&
    !DISALLOWED_ACTIVE_MIME_TYPES.has(normalized) &&
    allowedPrefixes.some((prefix) => normalized.startsWith(prefix))
  );
}

export function resolveStorageMimeType(storageType: unknown, claimedType: unknown) {
  const storageMimeType = normalizeMimeType(storageType);
  return storageMimeType || normalizeMimeType(claimedType);
}

export function storageMimeTypeMatchesClaim(storageType: unknown, claimedType: unknown) {
  const storageMimeType = normalizeMimeType(storageType);
  const claimedMimeType = normalizeMimeType(claimedType);
  return !(storageMimeType && claimedMimeType) || storageMimeType === claimedMimeType;
}

export function isExactAttachmentSize(actualSize: unknown, claimedSize: unknown) {
  return (
    typeof actualSize === "number" &&
    typeof claimedSize === "number" &&
    Number.isSafeInteger(actualSize) &&
    Number.isSafeInteger(claimedSize) &&
    actualSize >= 1 &&
    actualSize <= MAX_ATTACHMENT_BYTES &&
    actualSize === claimedSize
  );
}
