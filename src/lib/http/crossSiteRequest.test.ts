import { describe, expect, test } from "bun:test";
import { isCrossSiteBrowserRequest } from "./crossSiteRequest";

const SITE = { BETTER_AUTH_URL: "https://citius.test", NODE_ENV: "production" };

function post(headers: Record<string, string>) {
  return new Request("https://citius.test/api/profile", { headers, method: "POST" });
}

describe("Cross-site browser request guard", () => {
  test("allows a same-origin browser request", () => {
    expect(
      isCrossSiteBrowserRequest(
        post({ origin: "https://citius.test", "sec-fetch-site": "same-origin" }),
        SITE
      )
    ).toBe(false);
  });

  test("allows a request with no browser origin signals, such as a server or native client", () => {
    expect(isCrossSiteBrowserRequest(post({}), SITE)).toBe(false);
  });

  test("refuses a page on another origin, including a sibling subdomain", () => {
    expect(isCrossSiteBrowserRequest(post({ origin: "https://evil.example" }), SITE)).toBe(true);
    expect(
      isCrossSiteBrowserRequest(
        post({ origin: "https://blog.citius.test", "sec-fetch-site": "same-site" }),
        SITE
      )
    ).toBe(true);
    expect(isCrossSiteBrowserRequest(post({ origin: "null" }), SITE)).toBe(true);
  });

  test("refuses a cross-site fetch even when the browser omits Origin", () => {
    expect(isCrossSiteBrowserRequest(post({ "sec-fetch-site": "cross-site" }), SITE)).toBe(true);
  });

  test("fails closed when the site origin cannot be resolved", () => {
    expect(
      isCrossSiteBrowserRequest(post({ origin: "https://citius.test" }), { NODE_ENV: "production" })
    ).toBe(true);
  });
});
