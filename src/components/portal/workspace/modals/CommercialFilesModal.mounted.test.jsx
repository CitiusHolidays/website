// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks are intentionally local.
import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";

const fileRow = {
  attachmentId: "attachment-1",
  canDelete: true,
  canEditNote: true,
  canRestore: false,
  canRestoreHistory: false,
  category: "workingFile",
  createdAt: Date.UTC(2026, 7, 6),
  createdBy: "E2E Sales",
  fileKind: "attachment",
  fileName: "itinerary.pdf",
  fileSize: 1200,
  id: "legacy-query:attachment-1",
  lifecycle: "active",
  mimeType: "application/pdf",
  readOnly: false,
  sourceCode: "Q-0043",
  sourceId: "query-1",
  sourceLabel: "Q-0043",
  sourceType: "query",
  teamArea: "sales",
  teamLabel: "Sales",
  uploaderTeam: "Sales",
};
const sourceOption = {
  code: "Q-0043",
  id: "query-1",
  label: "Q-0043",
  sourceType: "query",
  teamAreas: ["sales"],
};
const queryResult = {
  items: [fileRow],
  nextCursor: null,
  sourceOptions: [sourceOption],
  total: 1,
  writableSources: [sourceOption],
};
const asyncNoop = async () => undefined;

mock.module("convex/react", () => ({
  useAction: () => asyncNoop,
  useMutation: () => asyncNoop,
  usePaginatedQuery: () => ({ results: [], status: "Exhausted" }),
  useQuery: () => queryResult,
}));

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal",
});

let CommercialFilesModal;
let createRoot;
let DocumentPreviewHost;
let PortalConfirmProvider;
let PortalToastProvider;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.CustomEvent = dom.window.CustomEvent;
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
  ({ DocumentPreviewHost } = await import(
    "@/components/portal/document-preview/DocumentPreviewHost"
  ));
  ({ PortalConfirmProvider } = await import("@/components/portal/PortalConfirmDialog"));
  ({ PortalToastProvider } = await import("@/components/portal/PortalToast"));
  ({ CommercialFilesModal } = await import("./CommercialFilesModal"));
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

const flushDialog = () => act(async () => new Promise((resolve) => setTimeout(resolve, 350)));

function Harness({ onClose }) {
  const [modal, setModal] = useState(null);
  const show = () => setModal("commercialFiles");
  const close = () => {
    onClose();
    setModal(null);
  };
  return (
    <DocumentPreviewHost>
      <PortalToastProvider>
        <PortalConfirmProvider>
          <button data-testid="commercial-opener" onClick={show} type="button">
            Manage files
          </button>
          <CommercialFilesModal
            close={close}
            form={{ entityId: "query-1", entryPoint: "query" }}
            modal={modal}
          />
        </PortalConfirmProvider>
      </PortalToastProvider>
    </DocumentPreviewHost>
  );
}

describe("CommercialFilesModal", () => {
  test("Preserves geometry and outside-only dismissal around a nested confirmation", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let closeCount = 0;
    const recordClose = () => {
      closeCount += 1;
    };
    await act(async () => root.render(<Harness onClose={recordClose} />));
    const opener = container.querySelector('[data-testid="commercial-opener"]');
    opener.focus();
    await act(async () => opener.click());
    await flushDialog();

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.className).toContain("max-w-6xl");
    expect(dialog?.className).toContain("max-h-[92vh]");
    expect(dialog?.className).toContain("max-sm:h-[100dvh]");
    expect(dialog?.parentElement.className).toContain("z-[80]");
    expect(dialog?.hasAttribute("data-starting-style")).toBe(false);
    expect(dialog?.textContent).toContain("Commercial Files");
    expect(dialog?.textContent).toContain("itinerary.pdf");
    expect(dialog?.textContent).toContain("Uploaded by Sales - E2E Sales");
    expect(dialog?.contains(document.activeElement)).toBe(true);

    globalThis.fetch = () =>
      Promise.resolve(
        Response.json(
          { canRetry: false, errorCode: "preview_unavailable", status: "unavailable" },
          { status: 422 }
        )
      );
    let previewRequest = null;
    const recordPreviewRequest = (event) => {
      previewRequest = event.detail;
    };
    window.addEventListener("citius:document-preview", recordPreviewRequest, { once: true });
    const viewButton = [...dialog.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "View"
    );
    viewButton.focus();
    await act(async () => viewButton.click());
    await flushDialog();
    expect(previewRequest?.sourceUrl).toBe(
      "/api/portal/files/commercial/legacy-query%3Aattachment-1"
    );
    const previewClose = document.querySelector('button[aria-label="Close document preview"]');
    const previewDialog = previewClose.closest('[role="dialog"]');
    expect(dialog.getAttribute("aria-modal")).toBeNull();
    expect(dialog.closest("[inert]")).not.toBeNull();
    expect(previewDialog.getAttribute("aria-modal")).toBe("true");
    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
    await act(async () => previewClose.click());
    await flushDialog();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
    expect(document.activeElement).toBe(viewButton);

    const uploadNote = dialog.querySelector('input[aria-label="Upload note (optional)"]');
    expect(uploadNote?.type).toBe("text");
    act(() => {
      uploadNote.value = "Draft upload note";
      uploadNote.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(uploadNote.value).toBe("Draft upload note");

    const editNoteButton = dialog.querySelector('button[aria-label="Edit note for itinerary.pdf"]');
    await act(async () => editNoteButton.click());
    const editNote = dialog.querySelector('input[aria-label="Edit note for itinerary.pdf"]');
    expect(editNote?.type).toBe("text");
    expect(editNote).not.toBe(uploadNote);
    act(() => {
      editNote.value = "Supplier revisions";
      editNote.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const saveNoteButton = [...dialog.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Save note"
    );
    await act(async () => saveNoteButton.click());
    expect(dialog.querySelector('input[aria-label="Edit note for itinerary.pdf"]')).toBeNull();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });
    await flushDialog();
    expect(closeCount).toBe(0);
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);

    const deleteButton = dialog.querySelector('button[aria-label="Delete itinerary.pdf"]');
    await act(async () => deleteButton.click());
    await flushDialog();
    const alert = document.querySelector('[role="alertdialog"]');
    expect(alert?.textContent).toContain("Delete commercial file");
    expect(document.activeElement?.textContent).toBe("Cancel");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });
    await flushDialog();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(deleteButton.getAttribute("data-tabindex")).toBe("0");

    const backdrop = document.querySelector('[class*="bg-slate-950/65"]');
    act(() => {
      backdrop.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushDialog();
    expect(closeCount).toBe(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);

    await act(async () => opener.click());
    await flushDialog();
    const reopenedDialog = document.querySelector('[role="dialog"]');
    const reopenedUploadNote = reopenedDialog.querySelector(
      'input[aria-label="Upload note (optional)"]'
    );
    expect(reopenedUploadNote.value).toBe("");

    await act(async () => root.unmount());
    container.remove();
  });
});
