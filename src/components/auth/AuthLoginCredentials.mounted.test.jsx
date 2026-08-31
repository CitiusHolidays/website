import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";

const googleTargets = [];
let rejectGoogle;
let AuthLoginCredentials;

mock.module("next/image", () => ({
  default: ({ alt = "" }) => <span aria-label={alt} role="img" />,
}));

mock.module("next/link", () => ({
  default: ({ children, href, ...props }) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

mock.module("@/lib/auth-client", () => ({
  signInWithEmail: () => Promise.resolve({ error: { message: "not used" } }),
  signInWithGoogle: (target) => {
    googleTargets.push(target);
    return new Promise((_resolve, reject) => {
      rejectGoogle = reject;
    });
  },
  signUpWithEmail: () => Promise.resolve({ error: { message: "not used" } }),
}));

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/auth/connect",
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
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  dom.window.matchMedia = () => ({
    addEventListener: () => undefined,
    matches: false,
    removeEventListener: () => undefined,
  });
  ({ AuthLoginCredentials } = await import("./AuthLoginCredentials"));
});

afterEach(() => {
  googleTargets.length = 0;
  rejectGoogle = undefined;
  document.body.replaceChildren();
});

afterAll(() => dom.window.close());

describe("Mounted auth provider action", () => {
  test("is single-flight, names the Google handoff, announces it, and restores error focus", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const variant = {
      allowSignup: false,
      href: "/portal",
      id: "employee",
    };

    await act(async () =>
      root.render(
        <AuthLoginCredentials
          brandLogo="/logo.png"
          brandLogoAlt="Citius Connect"
          copy={{
            signInSubtitle: "Open the Staff Workspace.",
            signInTitle: "Citius Connect",
            submitSignIn: "Sign in",
            submitSignUp: "Create account",
          }}
          returnTo="/portal/queries?open=salesDecision"
          variant={variant}
        />
      )
    );

    const google = [...container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Continue with Google")
    );
    await act(async () => {
      google.click();
      google.click();
      await Promise.resolve();
    });

    expect(googleTargets).toEqual(["/portal/queries?open=salesDecision"]);
    expect(google.textContent).toContain("Opening Google…");
    expect(google.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "Opening Google sign-in"
    );

    await act(async () => {
      rejectGoogle(new Error("private provider detail"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const alert = container.querySelector('[role="alert"]');
    expect(google.textContent).toContain("Continue with Google");
    expect(google.getAttribute("aria-busy")).toBe("false");
    expect(alert.textContent).toContain("We could not start Google sign-in");
    expect(alert.textContent).not.toContain("private provider detail");
    expect(document.activeElement).toBe(alert);

    await act(async () => root.unmount());
  });
});
