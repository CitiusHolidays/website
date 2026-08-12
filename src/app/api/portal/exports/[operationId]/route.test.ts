import { afterEach, describe, expect, test } from "bun:test";
import { type ExportProxyFetch, handlePortalExportDownload } from "./route";

const PRIVATE_CACHE_CONTROL = "private, no-store, max-age=0";
const originalSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = originalSiteUrl;
  }
});

function routeParams(operationId = "export-operation") {
  return Promise.resolve({ operationId });
}

function authenticatedOptions(fetchUpstream: ExportProxyFetch) {
  return {
    fetchUpstream,
    getAuthToken: () => Promise.resolve("portal-token"),
  };
}

describe("portal export proxy route", () => {
  test("returns a private 401 response before resolving params for an unauthenticated request", async () => {
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = "https://example.convex.site";
    const unresolvedParams = new Promise<{ operationId: string }>(() => undefined);

    const response = await handlePortalExportDownload(unresolvedParams, {
      fetchUpstream: () => Promise.reject(new Error("must not fetch")),
      getAuthToken: () => Promise.resolve(null),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe(PRIVATE_CACHE_CONTROL);
    expect(await response.json()).toEqual({ error: "Authentication required" });
  });

  test("returns a private 503 response when the export service URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

    const response = await handlePortalExportDownload(routeParams(), {
      fetchUpstream: () => Promise.reject(new Error("must not fetch")),
      getAuthToken: () => Promise.resolve("portal-token"),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe(PRIVATE_CACHE_CONTROL);
    expect(await response.json()).toEqual({ error: "Export service is not configured" });
  });

  test("returns a private 503 response when the upstream download is unavailable", async () => {
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = "https://example.convex.site/";

    const response = await handlePortalExportDownload(
      routeParams(),
      authenticatedOptions(() => Promise.reject(new Error("upstream unavailable")))
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe(PRIVATE_CACHE_CONTROL);
    expect(await response.json()).toEqual({
      error: "Export download is temporarily unavailable",
    });
  });

  test("maps an upstream 403 response to a private access-denied response", async () => {
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = "https://example.convex.site";

    const response = await handlePortalExportDownload(
      routeParams(),
      authenticatedOptions(() => Promise.resolve(new Response(null, { status: 403 })))
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe(PRIVATE_CACHE_CONTROL);
    expect(await response.json()).toEqual({ error: "Export access denied" });
  });

  test("maps an upstream 404 response to a private unavailable response", async () => {
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = "https://example.convex.site";

    const response = await handlePortalExportDownload(
      routeParams(),
      authenticatedOptions(() => Promise.resolve(new Response(null, { status: 404 })))
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe(PRIVATE_CACHE_CONTROL);
    expect(await response.json()).toEqual({ error: "Export file is not available" });
  });

  test("preserves Retry-After while mapping an upstream rate limit", async () => {
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = "https://example.convex.site";

    const response = await handlePortalExportDownload(
      routeParams(),
      authenticatedOptions(() =>
        Promise.resolve(new Response(null, { headers: { "Retry-After": "12" }, status: 429 }))
      )
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe(PRIVATE_CACHE_CONTROL);
    expect(response.headers.get("Retry-After")).toBe("12");
    expect(await response.json()).toEqual({ error: "Export file is not available" });
  });

  test("streams the upstream file with the private download and encoded path contract", async () => {
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = "https://example.convex.site/";
    const upstreamBody = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3]));
        controller.close();
      },
    });
    const upstream = new Response(upstreamBody, {
      headers: {
        "Content-Disposition": 'attachment; filename="passengers.xlsx"',
        "Content-Length": "3",
        "Content-Type": "application/vnd.test-export",
        "X-Upstream-Internal": "must-not-forward",
      },
    });
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetchUpstream: ExportProxyFetch = (input, init) => {
      fetchCalls.push({ init, input });
      return Promise.resolve(upstream);
    };

    const response = await handlePortalExportDownload(
      routeParams("../sales/export?admin=true"),
      authenticatedOptions(fetchUpstream)
    );

    expect(fetchCalls).toEqual([
      {
        init: {
          cache: "no-store",
          headers: { Authorization: "Bearer portal-token" },
          redirect: "error",
        },
        input: "https://example.convex.site/portal/exports/..%2Fsales%2Fexport%3Fadmin%3Dtrue",
      },
    ]);
    expect(response.status).toBe(200);
    expect(response.body).toBe(upstreamBody);
    expect(response.headers.get("Cache-Control")).toBe(PRIVATE_CACHE_CONTROL);
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="passengers.xlsx"'
    );
    expect(response.headers.get("Content-Length")).toBe("3");
    expect(response.headers.get("Content-Type")).toBe("application/vnd.test-export");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Upstream-Internal")).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
});
