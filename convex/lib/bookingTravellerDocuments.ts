import type { Value } from "convex/values";
import { isRuntimeObject } from "./runtimeValues";

/** Keys are compared lower-case with every non-alphanumeric character removed. */
const DOCUMENT_KEY_PREFIXES = [
  "passport",
  "aadhaar",
  "aadhar",
  "nationalid",
  "nationalityid",
  "dateofbirth",
  "birthdate",
];
const DOCUMENT_KEYS = new Set([
  "birthday",
  "dob",
  "documentnumber",
  "documentno",
  "governmentid",
  "idnumber",
  "idno",
]);
const MAX_DEPTH = 8;

function isDocumentKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    DOCUMENT_KEYS.has(normalized) ||
    normalized.includes("expiry") ||
    DOCUMENT_KEY_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

/** The redacted details and how many document fields were removed. */
export interface RedactedTravellerDetails {
  removed: number;
  value: Value;
}

function strip(value: Value, depth: number): RedactedTravellerDetails {
  if (depth > MAX_DEPTH || !isRuntimeObject(value)) {
    return { removed: 0, value };
  }
  if (Array.isArray(value)) {
    let removed = 0;
    const items = value.map((item) => {
      const result = strip(item, depth + 1);
      removed += result.removed;
      return result.value;
    });
    return { removed, value: items };
  }
  if (value instanceof ArrayBuffer) {
    return { removed: 0, value };
  }
  let removed = 0;
  const kept: Record<string, Value> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isDocumentKey(key)) {
      removed += 1;
      continue;
    }
    const result = strip(entry, depth + 1);
    removed += result.removed;
    kept[key] = result.value;
  }
  return { removed, value: kept };
}

/**
 * A kept booking's checkout traveller details without identity documents (owner decision,
 * 7 Nov 2026): passport fields, document expiry, national IDs (including Aadhaar) and dates of
 * birth are removed at any depth. Names, contacts, nationality and everything the invoice and
 * accounting use stay. The details are free-form JSON, so fields are matched by key name.
 */
export function withoutIdentityDocuments(details: Value): RedactedTravellerDetails {
  return strip(details, 0);
}
