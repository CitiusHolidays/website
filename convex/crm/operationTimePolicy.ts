export const OPERATION_STALL_THRESHOLD_MS = 120_000;

export function isOperationStalled(status: string, lastProgressAt: number, referenceNow: number) {
  return status === "running" && referenceNow - lastProgressAt > OPERATION_STALL_THRESHOLD_MS;
}

export function isOperationArtifactExpired(expiresAt: number | undefined, referenceNow: number) {
  return expiresAt !== undefined && expiresAt <= referenceNow;
}
