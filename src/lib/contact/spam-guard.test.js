import { afterEach, describe, expect, test } from "bun:test";
import {
  detectSpamContent,
  isAllowedSiteOrigin,
  isHoneypotTripped,
  MIN_FORM_SECONDS,
  validateFormTiming,
} from "./spam-guard.js";

const ALLOWED_SITE = "https://www.citiusholidays.com";

/** @param {Record<string, string>} headers */
function makeRequest(headers = {}) {
  return new Request("https://example.com/api/contact", {
    headers: new Headers(headers),
  });
}

describe("IsAllowedSiteOrigin", () => {
  let prevNodeEnv;
  let prevBetterAuthUrl;
  let prevSiteUrl;
  let prevPublicSiteUrl;
  let prevPublicAppUrl;

  afterEach(() => {
    if (prevNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = prevNodeEnv;
    }
    if (prevBetterAuthUrl === undefined) {
      delete process.env.BETTER_AUTH_URL;
    } else {
      process.env.BETTER_AUTH_URL = prevBetterAuthUrl;
    }
    if (prevSiteUrl === undefined) {
      delete process.env.SITE_URL;
    } else {
      process.env.SITE_URL = prevSiteUrl;
    }
    if (prevPublicSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = prevPublicSiteUrl;
    }
    if (prevPublicAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = prevPublicAppUrl;
    }
  });

  function withProductionSiteUrl(run) {
    prevNodeEnv = process.env.NODE_ENV;
    prevBetterAuthUrl = process.env.BETTER_AUTH_URL;
    prevSiteUrl = process.env.SITE_URL;
    prevPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    prevPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_URL = ALLOWED_SITE;
    process.env.SITE_URL = ALLOWED_SITE;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    return run();
  }

  test("Allows exact origin match", () => {
    withProductionSiteUrl(() => {
      const request = makeRequest({ origin: ALLOWED_SITE });
      expect(isAllowedSiteOrigin(request)).toBe(true);
    });
  });

  test("Rejects prefix-origin attack", () => {
    withProductionSiteUrl(() => {
      const request = makeRequest({
        origin: `${ALLOWED_SITE}.evil.test`,
      });
      expect(isAllowedSiteOrigin(request)).toBe(false);
    });
  });

  test("Allows valid referer from same origin", () => {
    withProductionSiteUrl(() => {
      const request = makeRequest({
        referer: `${ALLOWED_SITE}/contact`,
      });
      expect(isAllowedSiteOrigin(request)).toBe(true);
    });
  });

  test("Rejects malformed referer", () => {
    withProductionSiteUrl(() => {
      const request = makeRequest({ referer: "not-a-valid-url" });
      expect(isAllowedSiteOrigin(request)).toBe(false);
    });
  });

  test("Fails closed when site URL is missing in production", () => {
    withProductionSiteUrl(() => {
      delete process.env.SITE_URL;
      delete process.env.BETTER_AUTH_URL;
      const request = makeRequest({ origin: ALLOWED_SITE });
      expect(isAllowedSiteOrigin(request)).toBe(false);
    });
  });
});

describe("IsHoneypotTripped", () => {
  test("Empty honeypot passes", () => {
    expect(isHoneypotTripped("")).toBe(false);
    expect(isHoneypotTripped(undefined)).toBe(false);
  });

  test("Filled honeypot trips", () => {
    expect(isHoneypotTripped("Acme Inc")).toBe(true);
  });
});

describe("ValidateFormTiming", () => {
  test("Rejects missing or instant submit", () => {
    expect(validateFormTiming(undefined).ok).toBe(false);
    expect(validateFormTiming(Date.now()).ok).toBe(false);
  });

  test("Accepts submit after minimum delay", () => {
    const loadedAt = Date.now() - (MIN_FORM_SECONDS + 1) * 1000;
    expect(validateFormTiming(loadedAt).ok).toBe(true);
  });
});

describe("DetectSpamContent", () => {
  test("Flags obvious SEO spam", () => {
    const result = detectSpamContent({
      email: "mark@example.com",
      message: "We offer SEO services and backlink packages.",
      name: "Mark",
      subject: "Hello",
    });
    expect(result.spam).toBe(true);
  });

  test("Allows normal travel inquiry", () => {
    const result = detectSpamContent({
      email: "priya@example.com",
      message: "Looking for a 7-day family trip to Kerala in December.",
      name: "Priya Sharma",
      subject: "Kerala trip",
    });
    expect(result.spam).toBe(false);
  });
});
