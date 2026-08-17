import { describe, expect, test } from "bun:test";
import {
  isPortalFilePreviewRequest,
  isPortalFileRetryRequest,
  portalPreviewErrorResponse,
  portalPreviewResultResponse,
  portalPreviewUpstreamResponse,
  previewPortalFile,
} from "./file-preview";

describe("portal file preview route policy", () => {
  test("requires an explicit preview mode", () => {
    expect(
      isPortalFilePreviewRequest(
        new Request("https://citiusholidays.com/api/portal/files/query/attachment-1?mode=preview")
      )
    ).toBe(true);
    expect(
      isPortalFilePreviewRequest(
        new Request("https://citiusholidays.com/api/portal/files/query/attachment-1")
      )
    ).toBe(false);
    expect(
      isPortalFileRetryRequest(
        new Request(
          "https://citiusholidays.com/api/portal/files/query/attachment-1?mode=preview&retry=1"
        )
      )
    ).toBe(true);
  });

  test("returns ready preview bytes inline and never cacheable", async () => {
    const response = portalPreviewResultResponse({
      bytes: new TextEncoder().encode("private itinerary"),
      fileName: "itinerary.txt",
      generation: 2,
      mimeType: "text/plain",
      previewKind: "text",
      status: "ready",
      warningCodes: [],
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("inline;");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("X-Document-Preview-Kind")).toBe("text");
    expect(await response.text()).toBe("private itinerary");
  });

  test("keeps preparing and unavailable responses sanitized", async () => {
    const preparing = portalPreviewResultResponse({
      generation: 1,
      previewKind: "docx",
      status: "preparing",
    });
    expect(preparing.status).toBe(202);
    expect(preparing.headers.get("Retry-After")).toBe("2");
    expect(await preparing.json()).toEqual({ status: "preparing" });

    const unavailable = portalPreviewResultResponse({
      canRetry: false,
      errorCode: "encrypted",
      generation: 1,
      previewKind: "docx",
      status: "unavailable",
    });
    expect(unavailable.status).toBe(422);
    expect(await unavailable.json()).toEqual({
      canRetry: false,
      errorCode: "encrypted",
      status: "unavailable",
    });

    const internalFailure = portalPreviewErrorResponse(
      new Error("storageId secret-id leaked from internal worker")
    );
    expect(internalFailure.status).toBe(500);
    expect(await internalFailure.json()).toEqual({
      error: "Preview is unavailable. Download remains available.",
      status: "unavailable",
    });
  });

  test("proxies only safe private delivery headers and never exposes its token", async () => {
    const upstream = new Response("private itinerary", {
      headers: {
        "Content-Disposition": 'inline; filename="itinerary.txt"',
        "Content-Length": "17",
        "Content-Type": "text/plain",
        "X-Document-Preview-Generation": "2",
        "X-Document-Preview-Kind": "text",
        "X-Document-Preview-Warnings": "external_content_omitted",
        "X-Internal-Delivery-Token": "must-not-leak",
      },
    });

    const response = await portalPreviewUpstreamResponse(upstream);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("X-Document-Preview-Kind")).toBe("text");
    expect(response.headers.get("X-Internal-Delivery-Token")).toBeNull();
    expect(await response.text()).toBe("private itinerary");
  });

  test("exchanges a delivery token server-to-server without exposing it to the browser", async () => {
    const fetchCalls = [];
    const response = await previewPortalFile(
      { sourceId: "file-1", sourceType: "commercialFile" },
      {
        fetchUpstream: (input, init) => {
          fetchCalls.push({ init, input });
          return Promise.resolve(
            new Response("private itinerary", {
              headers: {
                "Content-Disposition": 'inline; filename="itinerary.txt"',
                "Content-Type": "text/plain",
                "X-Document-Preview-Kind": "text",
              },
            })
          );
        },
        getAuthToken: () => Promise.resolve("convex-user-token"),
        runAuthAction: () =>
          Promise.resolve({
            deliveryToken: "private-delivery-token",
            status: "ready",
          }),
        siteUrl: "https://example.convex.site/",
      }
    );

    expect(fetchCalls).toEqual([
      {
        init: {
          cache: "no-store",
          headers: { Authorization: "Bearer convex-user-token" },
          redirect: "error",
        },
        input: "https://example.convex.site/portal/document-previews/private-delivery-token",
      },
    ]);
    expect(response.headers.get("X-Internal-Delivery-Token")).toBeNull();
    expect(await response.text()).toBe("private itinerary");
  });
});
