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
  guardianLinks?: {
    linked: number;
    warnings: Array<{ fullName: string; message: string; sourceRowNumber?: number }>;
  };
  total: number;
  updated: number;
}

export interface PassengerImportResultMessage {
  failed: number;
  isPartialFailure: boolean;
  message: string;
}

function guardianLinkText(links: PassengerImportMutationResult["guardianLinks"]) {
  const parts = [
    links?.linked ? `Linked ${formatCount(links.linked, "minor")} to a guardian` : "",
    links?.warnings.length
      ? `${formatCount(links.warnings.length, "guardian reference")} ${links.warnings.length === 1 ? "needs" : "need"} review`
      : "",
  ].filter(Boolean);
  return parts.length > 0 ? ` ${parts.join("; ")}.` : "";
}

export function buildPassengerImportResultMessage(
  result: PassengerImportMutationResult,
  successLabel: string,
  roomSummaryText = ""
): PassengerImportResultMessage {
  const failed = Number(result.failed || 0);
  const base = `${successLabel}. Created ${result.created}, updated ${result.updated}, total processed ${result.total}.`;
  const room = roomSummaryText ? ` Room summary: ${roomSummaryText}` : "";
  const guardians = guardianLinkText(result.guardianLinks);
  return {
    failed,
    isPartialFailure: failed > 0,
    message:
      failed > 0
        ? `${base} ${formatCount(failed, "row")} failed.${guardians}${room}`
        : `${base}${guardians}${room}`,
  };
}

import { formatCount } from "@/lib/countMessage";
