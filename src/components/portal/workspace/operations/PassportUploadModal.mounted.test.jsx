// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks are intentionally local.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal",
});

let createRoot;
let PassportUploadModal;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  ({ createRoot } = await import("react-dom/client"));
  ({ PassportUploadModal } = await import("./PassportUploadModal"));
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

const flushDialog = () => act(async () => new Promise((resolve) => setTimeout(resolve, 350)));

function Harness({ isUploading, onClose }) {
  const [traveller, setTraveller] = useState(null);
  const [passportForm, setPassportForm] = useState({
    dateOfBirth: "",
    expiryDate: "",
    nationality: "",
    number: "",
  });
  const show = () => setTraveller({ fullName: "Asha Rao", id: "traveller-1" });
  const close = () => {
    onClose();
    setTraveller(null);
  };
  return (
    <>
      <button data-testid="passport-opener" onClick={show} type="button">
        Upload passport
      </button>
      <PassportUploadModal
        isUploading={isUploading}
        onClose={close}
        onSubmit={(event) => event.preventDefault()}
        passportForm={passportForm}
        setPassportForm={setPassportForm}
        uploadError=""
        uploadTraveller={traveller}
      />
    </>
  );
}

async function openPassport(root, isUploading, onClose) {
  await act(async () => root.render(<Harness isUploading={isUploading} onClose={onClose} />));
  const opener = document.querySelector('[data-testid="passport-opener"]');
  opener.focus();
  await act(async () => opener.click());
  await flushDialog();
  return { dialog: document.querySelector('[role="dialog"]'), opener };
}

describe("PassportUploadModal", () => {
  test("Preserves geometry, action order, and nondismissible outside/Escape policy", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let closeCount = 0;
    const view = await openPassport(root, false, () => {
      closeCount += 1;
    });

    expect(view.dialog?.className).toContain("max-w-lg");
    expect(view.dialog?.className).not.toContain("max-h-");
    expect(view.dialog?.parentElement.className).toContain("z-[90]");
    expect(view.dialog?.textContent).toContain("Upload & Encrypt Passport: Asha Rao");
    expect(view.dialog?.textContent).toContain("Passport Scan File (PDF, JPEG, or PNG, max 4 MB)");
    const buttons = [...view.dialog.querySelectorAll("button")].map((button) =>
      button.textContent.trim()
    );
    expect(buttons.at(-2)).toBe("Cancel");
    expect(buttons.at(-1)).toBe("Encrypt & Upload");
    expect(view.dialog?.contains(document.activeElement)).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });
    await flushDialog();
    const backdrop = document.querySelector('[class*="bg-slate-950/65"]');
    act(() => {
      backdrop.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushDialog();
    expect(closeCount).toBe(0);
    expect(document.querySelector('[role="dialog"]')).toBe(view.dialog);

    const cancel = [...view.dialog.querySelectorAll("button")].find(
      (button) => button.textContent === "Cancel"
    );
    await act(async () => cancel.click());
    await flushDialog();
    expect(closeCount).toBe(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(view.opener);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Keeps only the header Close available while encryption is pending", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let closeCount = 0;
    const view = await openPassport(root, true, () => {
      closeCount += 1;
    });
    const buttons = [...view.dialog.querySelectorAll("button")];
    const close = buttons.find((button) => button.textContent === "Close");
    const cancel = buttons.find((button) => button.textContent === "Cancel");
    const submit = buttons.find((button) => button.textContent.includes("Encrypting & Saving"));
    expect(close.disabled).toBe(false);
    expect(cancel.disabled).toBe(true);
    expect(submit.disabled).toBe(true);

    await act(async () => close.click());
    await flushDialog();
    expect(closeCount).toBe(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(view.opener);

    await act(async () => root.unmount());
    container.remove();
  });
});
