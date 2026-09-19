import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { requestDocumentPreview } from "@/lib/portal/documentPreview";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal",
});

let createRoot;
let DocumentPreviewHost;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  const matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: String(query),
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  globalThis.matchMedia = matchMedia;
  dom.window.matchMedia = matchMedia;
  ({ createRoot } = await import("react-dom/client"));
  ({ DocumentPreviewHost } = await import("./DocumentPreviewHost"));
});

afterEach(() => {
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/portal");
  globalThis.fetch = undefined;
});
afterAll(() => dom.window.close());

const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 350)));

describe("DocumentPreviewHost", () => {
  test("Opens private text in-app, exposes explicit download, and restores focus", async () => {
    globalThis.fetch = (url) => {
      expect(url).toBe("/api/portal/files/commercial/file-1?mode=preview");
      return Promise.resolve(
        new Response("Day 1: Delhi\nDay 2: Agra", {
          headers: {
            "Content-Disposition":
              "inline; filename=notes.txt; filename*=UTF-8''Sacred%20Bharat%20notes.txt",
            "Content-Type": "text/plain",
            "X-Document-Preview-Warnings": "unsupported_content_omitted",
          },
          status: 200,
        })
      );
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<DocumentPreviewHost />));
    const opener = document.createElement("button");
    opener.textContent = "View itinerary";
    document.body.append(opener);
    opener.focus();

    act(() => {
      requestDocumentPreview({ sourceUrl: "/api/portal/files/commercial/file-1" });
    });
    await flush();

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Sacred Bharat notes.txt");
    expect(dialog?.textContent).toContain("Day 1: Delhi");
    expect(dialog?.textContent).toContain("Document ready");
    expect(dialog?.textContent).toContain("Some unsupported content was omitted");
    const searchInput = dialog?.querySelector("#document-preview-search");
    expect(searchInput?.className).toContain("bg-white");
    expect(searchInput?.className).toContain("text-slate-950");
    expect(searchInput?.style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(searchInput?.style.color).toBe("rgb(15, 23, 42)");
    expect(
      dialog?.querySelector('a[download="Sacred Bharat notes.txt"]')?.getAttribute("href")
    ).toBe("/api/portal/files/commercial/file-1");
    expect(dialog?.contains(document.activeElement)).toBe(true);

    const close = dialog.querySelector('button[aria-label="Close document preview"]');
    await act(async () => close.click());
    await flush();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);

    await act(async () => root.unmount());
  });

  test("Offers an explicit retry and sends one retry request before rendering", async () => {
    const requestedUrls = [];
    globalThis.fetch = (url) => {
      requestedUrls.push(url);
      if (requestedUrls.length === 1) {
        return Promise.resolve(
          Response.json(
            { canRetry: true, errorCode: "conversion_failed", status: "unavailable" },
            { status: 422 }
          )
        );
      }
      return Promise.resolve(
        new Response("Recovered preview", {
          headers: {
            "Content-Disposition": "inline; filename=recovered.txt",
            "Content-Type": "text/plain",
          },
          status: 200,
        })
      );
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<DocumentPreviewHost />));

    act(() => {
      requestDocumentPreview({ sourceUrl: "/api/portal/files/query/attachment-1" });
    });
    await flush();

    const retryButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Retry preview"
    );
    expect(retryButton).not.toBeUndefined();
    await act(async () => retryButton.click());
    await flush();

    expect(requestedUrls).toEqual([
      "/api/portal/files/query/attachment-1?mode=preview",
      "/api/portal/files/query/attachment-1?mode=preview&retry=1",
    ]);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Recovered preview");

    await act(async () => root.unmount());
  });

  test.each([
    ["commercial/file-1", "commercial/file-2"],
    ["query/file-1", "proposal-finalized/file-2"],
  ])("Navigates %s to %s on demand without prefetching", async (firstSource, secondSource) => {
    const firstUrl = `/api/portal/files/${firstSource}`;
    const secondUrl = `/api/portal/files/${secondSource}`;
    const requestedUrls = [];
    globalThis.fetch = (url) => {
      requestedUrls.push(url);
      const second = String(url).includes("file-2");
      return Promise.resolve(
        new Response(second ? "Second file" : "First file", {
          headers: {
            "Content-Disposition": `inline; filename=${second ? "second" : "first"}.txt`,
            "Content-Type": "text/plain",
          },
          status: 200,
        })
      );
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<DocumentPreviewHost />));

    act(() => {
      requestDocumentPreview({
        navigation: {
          currentIndex: 0,
          items: [
            { fileName: "first.txt", sourceUrl: firstUrl },
            { fileName: "second.txt", sourceUrl: secondUrl },
          ],
        },
        sourceUrl: firstUrl,
      });
    });
    await flush();

    expect(requestedUrls).toHaveLength(1);
    const next = document.querySelector('button[aria-label="View next file"]');
    expect(next).not.toBeNull();
    await act(async () => next.click());
    await flush();

    expect(requestedUrls).toEqual([`${firstUrl}?mode=preview`, `${secondUrl}?mode=preview`]);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Second file");

    await act(async () => root.unmount());
  });

  test("Restores an authorized internal preview link and clears it on close", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response("Linked file", {
          headers: { "Content-Type": "text/plain" },
          status: 200,
        })
      );
    window.history.replaceState(
      null,
      "",
      "/portal?preview=%2Fapi%2Fportal%2Ffiles%2Fcommercial%2Ffile-1"
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<DocumentPreviewHost />));
    await flush();

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Linked file");
    expect(window.location.search).toContain("preview=");
    await act(async () =>
      dialog.querySelector('button[aria-label="Close document preview"]').click()
    );
    expect(window.location.search).toBe("");

    await act(async () => root.unmount());
  });

  test("Removes a malformed external preview link without opening or crashing", async () => {
    let fetchCount = 0;
    globalThis.fetch = () => {
      fetchCount += 1;
      return Promise.resolve(new Response("unexpected"));
    };
    window.history.replaceState(null, "", "/portal?preview=https%3A%2F%2Fevil.example%2Ffile");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<DocumentPreviewHost />));
    await flush();

    expect(fetchCount).toBe(0);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(window.location.search).toBe("");

    await act(async () => root.unmount());
  });

  test.each(["passport", "visa", "expense"])(
    "Suppresses navigation and adjacent bytes for %s documents",
    async (source) => {
      const requestedUrls = [];
      globalThis.fetch = (url) => {
        requestedUrls.push(url);
        return Promise.resolve(
          new Response("Sensitive file", {
            headers: { "Content-Type": "text/plain" },
            status: 200,
          })
        );
      };
      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);
      await act(async () => root.render(<DocumentPreviewHost />));

      act(() => {
        requestDocumentPreview({
          navigation: {
            currentIndex: 0,
            items: [
              { sourceUrl: `/api/portal/files/${source}/file-1` },
              { sourceUrl: `/api/portal/files/${source}/file-2` },
            ],
          },
          sourceUrl: `/api/portal/files/${source}/file-1`,
        });
      });
      await flush();

      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog?.textContent).toContain("Sensitive document");
      expect(dialog?.querySelector('button[aria-label="View next file"]')).toBeNull();
      expect(dialog?.querySelector('button[aria-label="View previous file"]')).toBeNull();
      expect(requestedUrls).toEqual([`/api/portal/files/${source}/file-1?mode=preview`]);

      await act(async () => root.unmount());
    }
  );

  test("Aborts a pending preview on close and discards its late response", async () => {
    const pending = Promise.withResolvers();
    let signal;
    globalThis.fetch = (_url, options) => {
      ({ signal } = options);
      return pending.promise;
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<DocumentPreviewHost />));
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    act(() => requestDocumentPreview({ sourceUrl: "/api/portal/files/expense/proof-1" }));
    await flush();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Loading document");
    await act(async () =>
      document.querySelector('button[aria-label="Close document preview"]').click()
    );
    expect(signal.aborted).toBe(true);
    pending.resolve(
      new Response("Late private content", { headers: { "Content-Type": "text/plain" } })
    );
    await flush();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).not.toContain("Late private content");
    expect(window.location.search).toBe("");
    expect(document.activeElement).toBe(opener);
    await act(async () => root.unmount());
  });

  test.each([401, 403, 404])(
    "Clears rendered expense bytes before a fresh request returns %s",
    async (status) => {
      const pending = Promise.withResolvers();
      let requests = 0;
      globalThis.fetch = () => {
        requests += 1;
        return requests === 1
          ? Promise.resolve(
              new Response("Original private proof", {
                headers: { "Content-Type": "text/plain" },
              })
            )
          : pending.promise;
      };
      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);
      await act(async () => root.render(<DocumentPreviewHost />));
      const sourceUrl = "/api/portal/files/expense/proof-1";
      act(() => requestDocumentPreview({ sourceUrl }));
      await flush();
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
        "Original private proof"
      );
      act(() => requestDocumentPreview({ historyMode: "none", sourceUrl }));
      expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain(
        "Original private proof"
      );
      pending.resolve(Response.json({ error: "File unavailable" }, { status }));
      await flush();
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog?.textContent).toContain("Preview unavailable");
      expect(dialog?.textContent).not.toContain("Original private proof");
      expect(dialog?.querySelector('[role="alert"]')).toBe(document.activeElement);
      expect(requests).toBe(2);
      await act(async () => root.unmount());
    }
  );

  test("Exposes accessible image zoom and rotation controls", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: {
            "Content-Disposition": "inline; filename=passport-scan.png",
            "Content-Type": "image/png",
          },
          status: 200,
        })
      );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<DocumentPreviewHost />));

    act(() => {
      requestDocumentPreview({ sourceUrl: "/api/portal/files/passport/traveller-1" });
    });
    await flush();

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.querySelector('button[aria-label="Zoom in"]')).not.toBeNull();
    expect(dialog?.querySelector('button[aria-label="Zoom out"]')).not.toBeNull();
    expect(dialog?.querySelector('button[aria-label="Rotate clockwise"]')).not.toBeNull();

    await act(async () => root.unmount());
  });
});
