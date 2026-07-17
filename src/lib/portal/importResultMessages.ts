export interface PassengerImportMutationResult {
  batches?: Array<{
    batchId: string;
    errors: Array<{
      id: string;
      kind: string;
      message: string;
      sourceRowNumber?: number;
    }>;
    status: string;
  }>;
  created: number;
  failed?: number;
  total: number;
  updated: number;
}

export interface PassengerImportResultMessage {
  failed: number;
  isPartialFailure: boolean;
  message: string;
}

export function buildPassengerImportResultMessage(
  result: PassengerImportMutationResult,
  successLabel: string,
  roomSummaryText = ""
): PassengerImportResultMessage {
  const failed = Number(result.failed || 0);
  const base = `${successLabel}. Created ${result.created}, updated ${result.updated}, total processed ${result.total}.`;
  const room = roomSummaryText ? ` Room summary: ${roomSummaryText}` : "";
  return {
    failed,
    isPartialFailure: failed > 0,
    message: failed > 0 ? `${base} ${failed} row(s) failed.${room}` : `${base}${room}`,
  };
}
