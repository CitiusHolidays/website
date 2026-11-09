import { afterAll, afterEach, beforeAll, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { JSDOM } from "jsdom";
import { act } from "react";

const stored = [];
let failingFileName = "";

mock.module("convex/react", () => ({
  useAction: (ref) => {
    if (getFunctionName(ref) === "crm/commercialFileActions:generateUploadUrl") {
      return () =>
        Promise.resolve({ uploadToken: "token", uploadUrl: "https://upload.citius.test/" });
    }
    return ({ fileName }) => {
      stored.push(fileName);
      return Promise.resolve();
    };
  },
}));

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal",
});
const originalFetch = globalThis.fetch;
let CommercialFileUploadEditor;
let PortalToastProvider;
let createRoot;
let root;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  for (const name of [
    "window",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "Element",
    "Node",
    "Event",
    "MouseEvent",
    "MutationObserver",
  ]) {
    globalThis[name] = dom.window[name] ?? dom.window;
  }
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  ({ createRoot } = await import("react-dom/client"));
  ({ PortalToastProvider } = await import("@/components/portal/PortalToast"));
  ({ CommercialFileUploadEditor } = await import("./CommercialFileUploadEditor"));
});
afterEach(async () => {
  if (root) {
    await act(() => root.unmount());
    root = null;
  }
  document.body.replaceChildren();
  globalThis.fetch = originalFetch;
  stored.length = 0;
  failingFileName = "";
});
afterAll(() => dom.window.close());

function stubStorage() {
  globalThis.fetch = Object.assign(
    (_url, init) =>
      Promise.resolve(
        init.body.name === failingFileName
          ? new Response("", { status: 500 })
          : Response.json({ storageId: `storage-${init.body.name}` })
      ),
    { preconnect: originalFetch.preconnect }
  );
}

async function mountEditor() {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <PortalToastProvider>
        <CommercialFileUploadEditor
          proposalDocAllowed={false}
          selectedSource={{
            code: "Q-0043",
            id: "query-1",
            label: "Q-0043",
            sourceType: "query",
            teamAreas: ["sales"],
          }}
          selectedTeamArea="sales"
        />
      </PortalToastProvider>
    )
  );
  return container;
}

async function chooseFiles(container, names) {
  const input = container.querySelector('input[type="file"]');
  const files = names.map((name) => new dom.window.File(["x"], name, { type: "application/pdf" }));
  Object.defineProperty(input, "files", { configurable: true, value: files });
  await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
}

async function upload(container) {
  const button = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent.includes("Upload files")
  );
  await act(async () => button.click());
}

test("a retry after a partial batch failure uploads only the files that were not stored", async () => {
  stubStorage();
  const container = await mountEditor();
  await chooseFiles(container, ["itinerary.pdf", "rooming.pdf"]);
  failingFileName = "rooming.pdf";

  await upload(container);

  expect(stored).toEqual(["itinerary.pdf"]);
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "Unable to upload rooming.pdf. Try again."
  );
  expect(container.textContent).toContain("1 file ready");
  expect(container.textContent).not.toContain("itinerary.pdf");

  failingFileName = "";
  await upload(container);

  expect(stored).toEqual(["itinerary.pdf", "rooming.pdf"]);
  expect(container.textContent).not.toContain("ready");
});
