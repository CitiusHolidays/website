export const PASSENGER_IMPORT_BATCH_SIZE = 50;

export function passengerImportBatchCount(total: number) {
  return Math.ceil(total / PASSENGER_IMPORT_BATCH_SIZE);
}

export function passengerImportBatchRowCount(total: number, batchIndex: number) {
  return Math.min(PASSENGER_IMPORT_BATCH_SIZE, total - batchIndex * PASSENGER_IMPORT_BATCH_SIZE);
}
