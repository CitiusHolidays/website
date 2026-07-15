import { describe, expect, test } from "bun:test";
import {
  LEGACY_RESEND_ENV_NAME,
  LEGACY_RESEND_ENV_SUNSET,
  resolveNotificationResendKey,
} from "./notificationEmailConfig";

describe("notification Resend environment transition", () => {
  test("uses RESEND_API_KEY as the canonical name", () => {
    expect(
      resolveNotificationResendKey({
        RESEND_API_KEY: "canonical-key",
        RESEND_KEY: "legacy-key",
      })
    ).toEqual({ key: "canonical-key", source: "RESEND_API_KEY" });
  });

  test("allows the documented legacy fallback during its migration window", () => {
    expect(resolveNotificationResendKey({ RESEND_KEY: "legacy-key" })).toEqual({
      key: "legacy-key",
      source: LEGACY_RESEND_ENV_NAME,
    });
    expect(LEGACY_RESEND_ENV_SUNSET).toBe("2026-09-30");
  });

  test("does not invent a key when both names are absent", () => {
    expect(resolveNotificationResendKey({})).toEqual({ key: null, source: null });
  });
});
