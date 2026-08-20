import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, Suspense } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const unresolvedPathname = new Promise(() => undefined);
let AppChromeFrame;
let createRoot;

function ReducedMotionProvider({ children }) {
  return children;
}

mock.module("next/navigation", () => ({
  usePathname: () => {
    throw unresolvedPathname;
  },
}));

mock.module("@/components/providers/ReducedMotionProvider", () => ({
  default: ReducedMotionProvider,
}));

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  ({ createRoot } = await import("react-dom/client"));
  ({ default: AppChromeFrame } = await import("./AppChromeFrame"));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

describe("AppChromeFrame runtime pathname boundary", () => {
  test("keeps the public page body renderable while route chrome waits for the pathname", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(() => {
      root.render(
        <Suspense fallback={<p>Outer fallback</p>}>
          <AppChromeFrame chatbot={<p>Chatbot</p>} footer={<p>Footer</p>} header={<p>Header</p>}>
            <p>Public page body</p>
          </AppChromeFrame>
        </Suspense>
      );
    });

    expect(container.textContent).toContain("Public page body");
    expect(container.textContent).not.toContain("Outer fallback");
    expect(container.textContent).not.toContain("Header");
    expect(container.textContent).not.toContain("Footer");
    expect(container.textContent).not.toContain("Chatbot");

    await act(() => root.unmount());
    container.remove();
  });
});
