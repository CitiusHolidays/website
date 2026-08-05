/**
 * Invite-code policy for Sacred Bharat private groups.
 *
 * Codes are generated from Web Crypto instead of Math.random. Six-character
 * legacy codes may still exist in already-created groups; newly-created groups
 * always receive a 128-bit code. The attempt state is persisted by the caller
 * in Convex so retries and separate function instances share the same window.
 */
export const INVITE_CODE_BYTES = 16;
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = Math.ceil((INVITE_CODE_BYTES * 8) / 5);
export const INVITE_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
export const INVITE_ATTEMPTS_PER_WINDOW = 5;

export interface InviteAttemptState {
  attemptCount: number;
  windowStartedAt: number;
}

export function makeInviteCode() {
  const bytes = new Uint8Array(INVITE_CODE_BYTES);
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Secure invite-code generation is unavailable");
  }
  cryptoApi.getRandomValues(bytes);

  let buffer = 0;
  let bits = 0;
  let code = "";
  for (const byte of bytes) {
    buffer = buffer * 256 + byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      const divisor = 2 ** bits;
      const index = Math.floor(buffer / divisor);
      code += INVITE_CODE_ALPHABET[index];
      buffer -= index * divisor;
    }
  }
  if (bits > 0) {
    const index = Math.floor(buffer * 2 ** (5 - bits));
    code += INVITE_CODE_ALPHABET[index];
  }
  return code;
}

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase();
}

export function isStrongInviteCode(value: string) {
  const normalized = normalizeInviteCode(value);
  return (
    normalized.length === INVITE_CODE_LENGTH &&
    [...normalized].every((character) => INVITE_CODE_ALPHABET.includes(character))
  );
}

export function consumeInviteAttempt(existing: InviteAttemptState | null, at: number) {
  const withinWindow =
    existing !== null &&
    at >= existing.windowStartedAt &&
    at - existing.windowStartedAt < INVITE_ATTEMPT_WINDOW_MS;
  const state = withinWindow ? existing : { attemptCount: 0, windowStartedAt: at };
  const nextCount = state.attemptCount + 1;
  const nextState = { attemptCount: nextCount, windowStartedAt: state.windowStartedAt };
  const allowed = nextCount <= INVITE_ATTEMPTS_PER_WINDOW;
  const retryAfterMs = allowed
    ? 0
    : Math.max(INVITE_ATTEMPT_WINDOW_MS - (at - state.windowStartedAt), 1);
  return { allowed, nextState, retryAfterMs };
}
