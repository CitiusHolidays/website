export const PASSENGER_IMPORT_CLIENT_BATCH_SIZE = 50;

interface PassengerImportBatchResult {
  accepted: number;
  batches: Array<{
    batchId: string;
    errors: Array<{ id: string; kind: "retryable" | "terminal"; message: string }>;
    status: string;
  }>;
  completed: boolean;
  created: number;
  failed: number;
  operationId: string;
  processed: number;
  remaining: number;
  roomSummary: Record<string, number>;
  rowResults: Array<{
    disposition: "created" | "failed" | "updated";
    fullName: string;
    id: string;
    message?: string;
    sourceRowNumber?: number;
    sourceSheet?: string;
  }>;
  total: number;
  updated: number;
}

export interface PassengerImportBatchProgress {
  batchTotal: number;
  completedBatches: number;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

export function chunkPassengerImportRows<T>(rows: T[]) {
  return Array.from(
    { length: Math.ceil(rows.length / PASSENGER_IMPORT_CLIENT_BATCH_SIZE) },
    (_, index) =>
      rows.slice(
        index * PASSENGER_IMPORT_CLIENT_BATCH_SIZE,
        (index + 1) * PASSENGER_IMPORT_CLIENT_BATCH_SIZE
      )
  );
}

export async function runPassengerImportBatchSequence<Row, Result>(
  batches: Row[][],
  commitBatch: (rows: Row[], batchIndex: number, batchTotal: number) => Promise<Result>,
  onBatchCompleted?: (progress: PassengerImportBatchProgress) => Promise<void> | void
) {
  const results: Result[] = [];
  for (const [batchIndex, rows] of batches.entries()) {
    // biome-ignore lint/performance/noAwaitInLoops: import batches must commit in manifest order.
    const result = await commitBatch(rows, batchIndex, batches.length);
    results.push(result);
    await onBatchCompleted?.({
      batchTotal: batches.length,
      completedBatches: batchIndex + 1,
    });
  }
  return results;
}

export async function digestPassengerImportSource(jobCardId: string, rows: unknown[]) {
  const source = JSON.stringify(canonicalize({ jobCardId, rows }));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function combinePassengerImportBatchResults(
  results: PassengerImportBatchResult[],
  total: number
) {
  if (results.length === 0) {
    throw new Error("Passenger import requires at least one row");
  }
  const combined = {
    accepted: 0,
    batches: [] as PassengerImportBatchResult["batches"],
    completed: true,
    created: 0,
    failed: 0,
    operationId: results[0].operationId,
    processed: 0,
    remaining: 0,
    roomSummary: {} as Record<string, number>,
    rowResults: [] as PassengerImportBatchResult["rowResults"],
    total,
    updated: 0,
  };
  for (const result of results) {
    combined.accepted += result.accepted;
    combined.batches.push(...result.batches);
    combined.created += result.created;
    combined.failed += result.failed;
    combined.processed += result.processed;
    combined.remaining += result.remaining;
    combined.rowResults.push(...result.rowResults);
    combined.updated += result.updated;
    for (const [roomType, count] of Object.entries(result.roomSummary)) {
      combined.roomSummary[roomType] = (combined.roomSummary[roomType] ?? 0) + count;
    }
  }
  combined.completed = combined.remaining === 0;
  return combined;
}
