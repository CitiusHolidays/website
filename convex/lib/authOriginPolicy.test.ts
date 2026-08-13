import { describe, expect, test } from "bun:test";
import {
  AuthOriginConfigurationError,
  deprecatedPublicSiteUrlError,
  resolveAuthOrigin,
} from "./authOriginPolicy";

describe("single-source authentication origin policy", () => {
  test("normalizes matching browser, Next, and Convex inputs", () => {
    expect(
      resolveAuthOrigin({
        BETTER_AUTH_URL: "https://travel.citius.in/auth",
        NEXT_PUBLIC_APP_URL: "https://travel.citius.in/account",
        SITE_URL: "https://travel.citius.in/",
      })
    ).toBe("https://travel.citius.in");
  });

  test("fails conflicting supported origins", () => {
    expect(() =>
      resolveAuthOrigin({
        BETTER_AUTH_URL: "https://travel.citius.in",
        NEXT_PUBLIC_APP_URL: "https://stale.citius.in",
      })
    ).toThrow("same authentication origin");
  });

  test("allows localhost fallback only outside production", () => {
    expect(resolveAuthOrigin({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(() => resolveAuthOrigin({ NODE_ENV: "production" })).toThrow(
      AuthOriginConfigurationError
    );
  });

  test("does not resolve auth from the deprecated public-site alias", () => {
    expect(
      resolveAuthOrigin({ NEXT_PUBLIC_SITE_URL: "https://ignored.example", NODE_ENV: "test" })
    ).toBe("http://localhost:3000");
    expect(
      deprecatedPublicSiteUrlError(
        { NEXT_PUBLIC_SITE_URL: "https://stale.example" },
        "https://travel.citius.in"
      )
    ).toContain("must not conflict");
  });
});
