import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import {
  AUTH_EMAILS_OVERALL_PER_HOUR,
  AUTH_EMAILS_PER_ADDRESS,
  type AuthAttemptKind,
  authAttemptKeyDigest,
  PASSWORD_SIGN_IN_OVERALL_PER_HOUR,
  PASSWORD_SIGN_IN_PER_ADDRESS,
  PASSWORD_SIGN_IN_PERIOD_MS,
} from "./lib/authAttemptLimits";
import schema from "./schema";
import { modules } from "./test.setup";

/**
 * Email+password sign-in and auth emails are limited per address in the database, whatever IP the
 * requests come from; the overall ceiling only raises an alarm.
 */

function harness() {
  const t = convexTest({ modules, schema });
  rateLimiterTest.register(t, "rateLimiter");
  return t;
}

type Harness = ReturnType<typeof harness>;

async function attempt(t: Harness, kind: AuthAttemptKind, email: string) {
  return await t.mutation(internal.authAttemptLimits.consumeAuthAttempt, {
    keyDigest: await authAttemptKeyDigest(kind, email),
    kind,
  });
}

async function attemptTimes(t: Harness, kind: AuthAttemptKind, email: string, times: number) {
  const outcomes: { ok: boolean }[] = [];
  for (let n = 0; n < times; n += 1) {
    outcomes.push(await attempt(t, kind, email));
  }
  return outcomes;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-11-10T06:00:00Z"));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Auth attempt limits", () => {
  test("refuses an address past its password attempts, aliases included, until it refills", async () => {
    const t = harness();
    const allowed = await attemptTimes(
      t,
      "password_sign_in",
      "person@example.test",
      PASSWORD_SIGN_IN_PER_ADDRESS
    );
    expect(allowed.every((outcome) => outcome.ok)).toBe(true);
    for (const alias of ["person@example.test", "Person+trip@EXAMPLE.test"]) {
      const refused = await attempt(t, "password_sign_in", alias);
      expect(refused.ok).toBe(false);
      expect(refused.ok === false && refused.retryAfterSeconds).toBeGreaterThan(0);
    }
    vi.advanceTimersByTime(PASSWORD_SIGN_IN_PERIOD_MS);
    expect((await attempt(t, "password_sign_in", "person@example.test")).ok).toBe(true);
  });

  test("keeps different addresses and kinds in separate buckets", async () => {
    const t = harness();
    await attemptTimes(t, "password_sign_in", "first@example.test", PASSWORD_SIGN_IN_PER_ADDRESS);
    expect((await attempt(t, "password_sign_in", "first@example.test")).ok).toBe(false);
    expect((await attempt(t, "password_sign_in", "second@example.test")).ok).toBe(true);
    // Running out of password attempts does not stop the reset email that recovers the account.
    expect((await attempt(t, "auth_email", "first@example.test")).ok).toBe(true);
  });

  test("sends an inbox a few auth emails an hour", async () => {
    const t = harness();
    const sent = await attemptTimes(t, "auth_email", "inbox@example.test", AUTH_EMAILS_PER_ADDRESS);
    expect(sent.every((outcome) => outcome.ok)).toBe(true);
    expect((await attempt(t, "auth_email", "INBOX+other@example.test")).ok).toBe(false);
    expect((await attempt(t, "auth_email", "another@example.test")).ok).toBe(true);
  });

  test("raises one alarm past the overall ceiling and refuses nobody for it", async () => {
    const t = harness();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const ceilings = [
      ["password_sign_in", PASSWORD_SIGN_IN_OVERALL_PER_HOUR],
      ["auth_email", AUTH_EMAILS_OVERALL_PER_HOUR],
    ] as const;
    for (const [kind, ceiling] of ceilings) {
      // A crowd of distinct addresses, each well inside its own limit, then one more: the
      // (sharded) ceiling is spent by then, so the alarm has fired.
      for (let n = 0; n <= ceiling; n += 1) {
        expect((await attempt(t, kind, `crowd-${n}@example.test`)).ok).toBe(true);
      }
      const past = await attemptTimes(t, kind, "real.customer@example.test", 3);
      expect(past.every((outcome) => outcome.ok)).toBe(true);
      const alarms = warn.mock.calls.filter(([line]) => String(line).includes(kind));
      expect(alarms).toEqual([[JSON.stringify({ event: "auth.attempt_overall_ceiling", kind })]]);
    }
    expect(JSON.stringify(warn.mock.calls)).not.toContain("example.test");
  }, 120_000);

  test("accepts only digests as keys", async () => {
    const t = harness();
    await expect(
      t.mutation(internal.authAttemptLimits.consumeAuthAttempt, {
        keyDigest: "person@example.test",
        kind: "password_sign_in",
      })
    ).rejects.toThrow("Invalid auth attempt key");
  });
});
