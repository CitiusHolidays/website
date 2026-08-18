import { describe, expect, test } from "bun:test";
import {
  consumeInviteAttempt,
  INVITE_ATTEMPT_WINDOW_MS,
  INVITE_ATTEMPTS_PER_WINDOW,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  type InviteAttemptState,
  isStrongInviteCode,
  makeInviteCode,
} from "./sacredBharatInvites";

describe("Sacred Bharat invite policy", () => {
  test("Generates a high-entropy code with the restricted alphabet", () => {
    const code = makeInviteCode();
    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    expect(isStrongInviteCode(code)).toBe(true);
    expect([...code].every((character) => INVITE_CODE_ALPHABET.includes(character))).toBe(true);
    expect(makeInviteCode()).not.toBe(code);
  });

  test("Allows five attempts and blocks the sixth until the window ends", () => {
    const startedAt = 1_700_000_000_000;
    let state: InviteAttemptState | null = null;
    for (let index = 0; index < INVITE_ATTEMPTS_PER_WINDOW; index += 1) {
      const result = consumeInviteAttempt(state, startedAt + index);
      expect(result.allowed).toBe(true);
      state = result.nextState;
    }
    const blocked = consumeInviteAttempt(state, startedAt + 100);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  test("Starts a fresh window after the cooldown", () => {
    const startedAt = 1_700_000_000_000;
    const exhausted = {
      attemptCount: INVITE_ATTEMPTS_PER_WINDOW,
      windowStartedAt: startedAt,
    };
    const result = consumeInviteAttempt(exhausted, startedAt + INVITE_ATTEMPT_WINDOW_MS);
    expect(result.allowed).toBe(true);
    expect(result.nextState).toEqual({
      attemptCount: 1,
      windowStartedAt: startedAt + INVITE_ATTEMPT_WINDOW_MS,
    });
  });
});
