import { describe, expect, test } from "bun:test";
import {
  AUTH_TOKEN_EXCHANGE_KINDS,
  AuthTokenExchangeError,
  fetchConvexTokenFromHeaders,
  isRetryableAuthTokenExchangeError,
  resolveTrustedAppOrigin,
} from "./auth-server";

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

  test("returns null only for a reviewed unauthenticated response", async () => {
    const requests = [];
    const token = await fetchConvexTokenFromHeaders(
      new Headers({ cookie: "better-auth.session_token=expired" }),
      {
        fetchImpl: (url, init) => {
          requests.push({ init, url });
          return Promise.resolve(new Response(null, { status: 401 }));
        },
        trustedOrigin: "https://travel.citius.in",
      }
    );

    expect(token).toBeNull();
    expect(requests).toHaveLength(1);
  });

  test("retries network failures and throws a typed recoverable error", async () => {
    let attempts = 0;

    const promise = fetchConvexTokenFromHeaders(
      new Headers({ cookie: "better-auth.session_token=secret" }),
      {
        correlationId: "corr-network",
        fetchImpl: () => {
          attempts += 1;
          return Promise.reject(new Error("socket closed"));
        },
        trustedOrigin: "https://travel.citius.in",
      }
    );

    let error;
    try {
      await promise;
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(AuthTokenExchangeError);
    expect(error).toMatchObject({
      code: "AUTH_TOKEN_EXCHANGE_TRANSIENT",
      correlationId: "corr-network",
      kind: AUTH_TOKEN_EXCHANGE_KINDS.TRANSIENT,
      retryable: true,
    });
    expect(isRetryableAuthTokenExchangeError(error)).toBe(true);
    expect(error.message).not.toContain("secret");
    expect(attempts).toBe(2);
  });

  test("retries upstream 5xx responses without treating them as logout", async () => {
    let attempts = 0;

    await expect(
      fetchConvexTokenFromHeaders(new Headers(), {
        correlationId: "corr-5xx",
        fetchImpl: () => {
          attempts += 1;
          return Promise.resolve(new Response("upstream unavailable", { status: 503 }));
        },
        trustedOrigin: "https://travel.citius.in",
      })
    ).rejects.toMatchObject({
      code: "AUTH_TOKEN_EXCHANGE_TRANSIENT",
      correlationId: "corr-5xx",
      status: 503,
    });

    expect(attempts).toBe(2);
  });

  test("classifies malformed token responses and never exposes cookie data", async () => {
    let error;
    try {
      await fetchConvexTokenFromHeaders(
        new Headers({ cookie: "better-auth.session_token=secret" }),
        {
          correlationId: "corr-malformed",
          fetchImpl: () =>
            Promise.resolve(new Response(JSON.stringify({ token: " " }), { status: 200 })),
          trustedOrigin: "https://travel.citius.in",
        }
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      code: "AUTH_TOKEN_EXCHANGE_MALFORMED",
      correlationId: "corr-malformed",
      kind: AUTH_TOKEN_EXCHANGE_KINDS.MALFORMED,
      retryable: true,
    });
    expect(error.message).not.toContain("secret");
  });

  test("classifies malformed origins as configuration failures", async () => {
    await expect(
      fetchConvexTokenFromHeaders(new Headers(), {
        correlationId: "corr-config",
        trustedOrigin: "javascript:alert(1)",
      })
    ).rejects.toMatchObject({
      code: "AUTH_TOKEN_EXCHANGE_CONFIGURATION",
      correlationId: "corr-config",
      kind: AUTH_TOKEN_EXCHANGE_KINDS.CONFIGURATION,
      retryable: false,
    });
  });
});
