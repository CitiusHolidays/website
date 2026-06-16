export function buildPassengerImportResultMessage(result, successLabel, roomSummaryText = "") {
  const failed = Number(result?.failed || 0);
  const base = `${successLabel}. Created ${result.created}, updated ${result.updated}, total processed ${result.total}.`;
  const room = roomSummaryText ? ` Room summary: ${roomSummaryText}` : "";
  return {
    failed,
    isPartialFailure: failed > 0,
    message: failed > 0 ? `${base} ${failed} row(s) failed.${room}` : `${base}${room}`,
  };
}
