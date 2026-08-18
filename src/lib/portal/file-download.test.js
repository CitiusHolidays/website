import { describe, expect, test } from "bun:test";
import {
  consumePortalFileDownload,
  PORTAL_FILE_DOWNLOAD_LIMIT,
  PORTAL_FILE_DOWNLOAD_WINDOW_MS,
} from "./file-download";

describe("Portal file download limiter", () => {
  test("Limits each authenticated identity independently", () => {
    const now = 1_750_000_000_000;
    for (let attempt = 0; attempt < PORTAL_FILE_DOWNLOAD_LIMIT; attempt += 1) {
      expect(consumePortalFileDownload("staff-a", now)).toMatchObject({
        allowed: true,
        remaining: PORTAL_FILE_DOWNLOAD_LIMIT - attempt - 1,
      });
    }

    expect(consumePortalFileDownload("staff-a", now)).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
    });
    expect(consumePortalFileDownload("staff-b", now)).toMatchObject({
      allowed: true,
      remaining: PORTAL_FILE_DOWNLOAD_LIMIT - 1,
    });
  });

  test("Starts a fresh window after the bounded interval", () => {
    const now = 1_750_000_100_000;
    for (let attempt = 0; attempt < PORTAL_FILE_DOWNLOAD_LIMIT; attempt += 1) {
      consumePortalFileDownload("staff-window", now);
    }

    const nextWindow = consumePortalFileDownload(
      "staff-window",
      now + PORTAL_FILE_DOWNLOAD_WINDOW_MS
    );
    expect(nextWindow).toEqual({
      allowed: true,
      remaining: PORTAL_FILE_DOWNLOAD_LIMIT - 1,
      retryAfterSeconds: null,
    });
  });

  test("Does not rate-limit an unidentified request before Convex authorization", () => {
    expect(consumePortalFileDownload(null, 1_750_000_200_000)).toEqual({
      allowed: true,
      remaining: null,
      retryAfterSeconds: null,
    });
  });
});
