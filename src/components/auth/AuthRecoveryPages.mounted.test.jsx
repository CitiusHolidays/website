import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";

const resetRequests = [];
const routerPushes = [];
let resolveResetRequest;
let ForgotPasswordPage;
let ResetPasswordPage;

mock.module("next/image", () => ({
  default: ({ alt = "" }) => <span aria-label={alt} role="img" />,
}));

function LinkMock({ children, href, ref, ...props }) {
  return (
    <a href={String(href)} ref={ref} {...props}>
      {children}
    </a>
  );
}

mock.module("next/link", () => ({ default: LinkMock }));

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: (href) => routerPushes.push(href),
  }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

mock.module("@/lib/auth-client", () => ({
  authClient: {
    requestPasswordReset: (request) => {
      resetRequests.push(request);
      return new Promise((resolve) => {
        resolveResetRequest = resolve;
      });
    },
    resetPassword: () => Promise.resolve({}),
  },
}));

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/auth/forgot-password",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  dom.window.HTMLElement.prototype.attachEvent = () => undefined;
  dom.window.HTMLElement.prototype.detachEvent = () => undefined;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  dom.window.matchMedia = () => ({
    addEventListener: () => undefined,
    matches: false,
    removeEventListener: () => undefined,
  });
  ({ default: ForgotPasswordPage } = await import("@/app/(auth)/auth/forgot-password/page.client"));
  ({ default: ResetPasswordPage } = await import("@/app/(auth)/auth/reset-password/page.client"));
});

afterEach(() => {
  resetRequests.length = 0;
  routerPushes.length = 0;
  resolveResetRequest = undefined;
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/auth/forgot-password");
});

afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, root };
}

describe("Mounted destination-aware auth recovery", () => {
  test("keeps the Staff destination while reset-email delivery is single-flight and recoverable", async () => {
    const view = await mount(
      <ForgotPasswordPage returnTo="/portal/queries?open=salesDecision" variantId="employee" />
    );
    const email = view.container.querySelector("#forgot-email");
    const form = email.closest("form");

    await act(async () => {
      email.value = "staff@example.com";
      email.dispatchEvent(new Event("input", { bubbles: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(resetRequests).toHaveLength(1);
    expect(resetRequests[0].redirectTo).toBe(
      "https://citiusholidays.com/auth/reset-password?callbackUrl=%2Fportal%2Fqueries%3Fopen%3DsalesDecision"
    );
    expect(view.container.textContent).toContain("Sending…");

    await act(async () => {
      resolveResetRequest({ error: { message: "private provider failure" } });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(view.container.textContent).toContain("Citius Connect");
    expect(view.container.textContent).not.toContain("private provider failure");
    expect(document.activeElement?.id).toBe("forgot-email");
    expect(view.container.querySelector('a[href^="/auth/connect?"]')?.textContent).toContain(
      "Citius Connect"
    );
    await act(async () => view.root.unmount());
  });

  test("fails a missing or expired reset token closed and focuses the recovery action", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password?callbackUrl=%2Fportal%2Fqueries&error=INVALID_TOKEN"
    );
    const view = await mount(<ResetPasswordPage returnTo="/portal/queries" variantId="employee" />);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(view.container.querySelector("#reset-password")).toBeNull();
    expect(view.container.textContent).toContain("missing, invalid, or expired");
    const recovery = view.container.querySelector('a[href^="/auth/forgot-password?"]');
    expect(recovery?.textContent).toContain("Request a new link");
    expect(document.activeElement).toBe(recovery);
    expect(routerPushes).toEqual([]);
    await act(async () => view.root.unmount());
  });
});
