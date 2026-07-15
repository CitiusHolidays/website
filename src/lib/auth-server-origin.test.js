import { describe, expect, test } from "bun:test";
import { fetchConvexTokenFromHeaders, resolveTrustedAppOrigin } from "./auth-server";

describe("server authentication origin", () => {
  test("hostile forwarded headers cannot move the authenticated token request", async () => {
    const requests = [];
    const requestHeaders = new Headers({
      authorization: "Bearer must-not-forward",
      cookie: "better-auth.session_token=session-secret; theme=dark",
      host: "attacker.example",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "http",
    });

    const token = await fetchConvexTokenFromHeaders(requestHeaders, {
      fetchImpl: (url, init) => {
        requests.push({ init, url });
        return Promise.resolve(
          new Response(JSON.stringify({ token: "convex-token" }), {
            headers: { "content-type": "application/json" },
            status: 200,
          })
        );
      },
      trustedOrigin: "https://travel.citius.in",
    });

    expect(token).toBe("convex-token");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://travel.citius.in/api/auth/convex/token");
    expect(requests[0].init.headers).toEqual({
      accept: "application/json",
      cookie: "better-auth.session_token=session-secret",
    });
  });

  test("configured application URLs are normalized to an HTTP origin", () => {
    expect(
      resolveTrustedAppOrigin({
        BETTER_AUTH_URL: "https://travel.citius.in/auth/path?ignored=true",
      })
    ).toBe("https://travel.citius.in");
    expect(() =>
      resolveTrustedAppOrigin({ BETTER_AUTH_URL: "javascript:alert(1)", NODE_ENV: "production" })
    ).toThrow("trusted application origin");
  });
});
