import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import { isRuntimeObject } from "../lib/runtimeValues";
export const IMPORT_WORKER_CONCURRENCY = 3;
const RETRYABLE_IMPORT_ERROR_PATTERN =
  /timeout|timed out|temporar|unavailable|rate.?limit|conflict|network|connection|retry/i;
const WHITESPACE_PATTERN = /\s+/g;

export type ImportFailureKind = "retryable" | "terminal";

export function classifyImportError(cause: unknown): ImportFailureKind {
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  return RETRYABLE_IMPORT_ERROR_PATTERN.test(message) ? "retryable" : "terminal";
}

export function publicImportErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause ?? "Import failed");
  return message.replace(WHITESPACE_PATTERN, " ").trim().slice(0, 240) || "Import failed";
}

function canonicalImportValue(value: RuntimeValue): RuntimeValue {
  if (Array.isArray(value)) {
    return value.map(canonicalImportValue);
  }
  if (value && isRuntimeObject(value)) {
    // SAFETY: the array branch returned above, so this runtime object is the dictionary variant of RuntimeValue.
    return Object.fromEntries(
      Object.entries(value as RuntimeObject)
        .filter(([key]) => key !== "encryptedPassportPayload")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalImportValue(entry)] as const)
    );
  }
  return value;
}

function stableHash(value: string) {
  const uint32Range = 4_294_967_296;
  const toUint32 = (candidate: number) => (candidate < 0 ? candidate + uint32Range : candidate);
  const xorUint32 = (first: number, second: number) => {
    let leftValue = first;
    let rightValue = second;
    let result = 0;
    let place = 1;
    for (let bit = 0; bit < 32; bit += 1) {
      if (leftValue % 2 !== rightValue % 2) {
        result += place;
      }
      leftValue = Math.floor(leftValue / 2);
      rightValue = Math.floor(rightValue / 2);
      place *= 2;
    }
    return result;
  };
  let left = 0x81_1c_9d_c5;
  let right = 0x9e_37_79_b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = toUint32(Math.imul(xorUint32(left, code), 0x01_00_01_93));
    right = toUint32(Math.imul(xorUint32(right, code + index), 0x85_eb_ca_6b));
  }
  return `${left.toString(16).padStart(8, "0")}${right.toString(16).padStart(8, "0")}`;
}

export function stableImportBatchId(jobCardId: string, batchIndex: number, rows: RuntimeValue[]) {
  const canonical = JSON.stringify({
    batchIndex,
    jobCardId,
    rows: canonicalImportValue(rows),
  });
  return `passenger:${jobCardId}:${batchIndex}:${stableHash(canonical)}`;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Import worker concurrency must be a positive integer");
  }
  const results: R[] = [];
  results.length = items.length;
  let nextIndex = 0;
  const runNext = async (): Promise<void> => {
    if (nextIndex >= items.length) {
      return;
    }
    const index = nextIndex;
    nextIndex += 1;
    results[index] = await worker(items[index], index);
    await runNext();
  };
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, runNext);
  await Promise.all(workers);
  return results;
}

export interface ImportBatchResult {
  accepted: number;
  batchId: string;
  created: number;
  errors: Array<{ id: string; kind: ImportFailureKind; message: string }>;
  failed: number;
  processed: number;
  remaining: number;
  roomSummary: Record<string, number>;
  rowResults?: Array<{
    disposition: "created" | "failed" | "updated";
    fullName: string;
    id: string;
    message?: string;
    sourceRowNumber?: number;
    sourceSheet?: string;
  }>;
  status: string;
  updated: number;
}

interface ImportBatchSummary {
  accepted: number;
  completed: boolean;
  created: number;
  failed: number;
  processed: number;
  remaining: number;
  roomSummary: Record<string, number>;
  rowResults: NonNullable<ImportBatchResult["rowResults"]>;
  updated: number;
}

export function summarizeImportBatchResults(batchResults: ImportBatchResult[]) {
  const summary: ImportBatchSummary = {
    accepted: 0,
    completed: true,
    created: 0,
    failed: 0,
    processed: 0,
    remaining: 0,
    roomSummary: {},
    rowResults: [],
    updated: 0,
  };
  for (const result of batchResults) {
    summary.accepted += result.accepted;
    summary.created += result.created;
    summary.updated += result.updated;
    summary.failed += result.failed;
    summary.processed += result.processed;
    summary.remaining += result.remaining;
    summary.rowResults = summary.rowResults.concat(result.rowResults ?? []);
    for (const [roomType, count] of Object.entries(result.roomSummary)) {
      summary.roomSummary[roomType] = (summary.roomSummary[roomType] ?? 0) + count;
    }
  }
  summary.completed = summary.remaining === 0;
  return summary;
}
