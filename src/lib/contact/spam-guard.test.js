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

describe("isAllowedSiteOrigin", () => {
  let prevNodeEnv;
  let prevSiteUrl;
  let prevPublicSiteUrl;
  let prevPublicAppUrl;

  afterEach(() => {
    if (prevNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = prevNodeEnv;
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
    prevSiteUrl = process.env.SITE_URL;
    prevPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    prevPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    process.env.NODE_ENV = "production";
    process.env.SITE_URL = ALLOWED_SITE;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    return run();
  }

  test("allows exact origin match", () => {
    withProductionSiteUrl(() => {
      const request = makeRequest({ origin: ALLOWED_SITE });
      expect(isAllowedSiteOrigin(request)).toBe(true);
    });
  });

  test("rejects prefix-origin attack", () => {
    withProductionSiteUrl(() => {
      const request = makeRequest({
        origin: `${ALLOWED_SITE}.evil.test`,
      });
      expect(isAllowedSiteOrigin(request)).toBe(false);
    });
  });

  test("allows valid referer from same origin", () => {
    withProductionSiteUrl(() => {
      const request = makeRequest({
        referer: `${ALLOWED_SITE}/contact`,
      });
      expect(isAllowedSiteOrigin(request)).toBe(true);
    });
  });

  test("rejects malformed referer", () => {
    withProductionSiteUrl(() => {
      const request = makeRequest({ referer: "not-a-valid-url" });
      expect(isAllowedSiteOrigin(request)).toBe(false);
    });
  });

  test("fails closed when site URL is missing in production", () => {
    withProductionSiteUrl(() => {
      delete process.env.SITE_URL;
      const request = makeRequest({ origin: ALLOWED_SITE });
      expect(isAllowedSiteOrigin(request)).toBe(false);
    });
  });
});

describe("isHoneypotTripped", () => {
  test("empty honeypot passes", () => {
    expect(isHoneypotTripped("")).toBe(false);
    expect(isHoneypotTripped(undefined)).toBe(false);
  });

  test("filled honeypot trips", () => {
    expect(isHoneypotTripped("Acme Inc")).toBe(true);
  });
});

describe("validateFormTiming", () => {
  test("rejects missing or instant submit", () => {
    expect(validateFormTiming(undefined).ok).toBe(false);
    expect(validateFormTiming(Date.now()).ok).toBe(false);
  });

  test("accepts submit after minimum delay", () => {
    const loadedAt = Date.now() - (MIN_FORM_SECONDS + 1) * 1000;
    expect(validateFormTiming(loadedAt).ok).toBe(true);
  });
});

describe("detectSpamContent", () => {
  test("flags obvious SEO spam", () => {
    const result = detectSpamContent({
      email: "mark@example.com",
      message: "We offer SEO services and backlink packages.",
      name: "Mark",
      subject: "Hello",
    });
    expect(result.spam).toBe(true);
  });

  test("allows normal travel inquiry", () => {
    const result = detectSpamContent({
      email: "priya@example.com",
      message: "Looking for a 7-day family trip to Kerala in December.",
      name: "Priya Sharma",
      subject: "Kerala trip",
    });
    expect(result.spam).toBe(false);
  });
});
