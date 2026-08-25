// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks stay close to their harness.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { HeaderMobileMenu } from "./HeaderMobileMenu";

const noop = () => undefined;
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/",
});

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/mice", label: "MICE" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.Event = dom.window.Event;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
});

afterAll(() => dom.window.close());

function Harness({
  canAccessPortal = false,
  isPending = false,
  pathname = dom.window.location.pathname,
  user = { name: "Test traveller" },
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div id="background-content">
        <button id="menu-trigger" onClick={() => setOpen(true)} type="button">
          Open menu
        </button>
      </div>
      <HeaderMobileMenu
        canAccessPortal={canAccessPortal}
        isOpen={open}
        isPending={isPending}
        navLinks={navLinks}
        onClose={() => setOpen(false)}
        onLogout={noop}
        pathname={pathname}
        user={user}
      />
    </>
  );
}

async function mountMenu(props) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Harness {...props} />));
  const trigger = container.querySelector("#menu-trigger");
  trigger.focus();
  await act(async () => trigger.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  return {
    container,
    root,
    trigger,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("HeaderMobileMenu", () => {
  test("Traps focus, makes the page inert, and restores the trigger on Escape", async () => {
    const view = await mountMenu();

    const dialog = view.container.querySelector('[role="dialog"]');
    const close = dialog.querySelector('button[aria-label="Close menu"]');
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(view.container.querySelector("#background-content").hasAttribute("inert")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(close);

    await act(async () =>
      dialog.dispatchEvent(new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Tab" }))
    );
    expect(document.activeElement).not.toBe(view.trigger);

    await act(async () =>
      dialog.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      )
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    expect(view.container.querySelector("#background-content").hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(view.trigger);

    await view.unmount();
  });

  test("Uses a compact sheet with active links, collapsed trails, sticky actions, and account parity", async () => {
    dom.window.history.replaceState({}, "", "/blog");
    const view = await mountMenu({ canAccessPortal: true });
    const dialog = view.container.querySelector('[role="dialog"]');
    const sheet = dialog.querySelector("[data-mobile-menu-sheet]");
    const sticky = dialog.querySelector("[data-mobile-menu-sticky]");
    const blog = dialog.querySelector('a[href="/blog"]');

    expect(sheet.className).toContain("ml-auto");
    expect(sheet.className).toContain("h-[100dvh]");
    expect(dialog.querySelector('nav[aria-label="Primary"]')).not.toBeNull();
    expect(blog.getAttribute("aria-current")).toBe("page");
    expect(blog.getAttribute("data-active")).toBe("true");
    expect(blog.className).toContain("min-h-11");
    expect(dialog.querySelector("details").open).toBe(false);
    expect(sticky.className).toContain("shrink-0");
    expect(sticky.querySelector('a[href="/contact"]').textContent).toContain("Plan your trip");
    expect(sticky.querySelector('a[href="/account"]')).not.toBeNull();
    expect(sticky.querySelector('a[href="/portal"]')).not.toBeNull();

    await view.unmount();
  });

  test("Shows a pending session status instead of anonymous actions", async () => {
    const view = await mountMenu({ isPending: true, user: null });
    const dialog = view.container.querySelector('[role="dialog"]');

    expect(dialog.querySelector('[role="status"][aria-busy="true"]').textContent).toContain(
      "Checking your account"
    );
    expect(dialog.textContent).not.toContain("Guest Connect");
    expect(dialog.textContent).not.toContain("Citius Connect");

    await view.unmount();
  });

  test("Shows compact guest and staff sign-in actions for anonymous visitors", async () => {
    const view = await mountMenu({ user: null });
    const actions = view.container.querySelector('nav[aria-label="Sign in"]');

    expect(actions.className).toContain("grid-cols-2");
    expect(actions.querySelector('a[href="/auth/guest"]')).not.toBeNull();
    expect(actions.querySelector('a[href="/auth/connect"]')).not.toBeNull();

    await view.unmount();
  });

  test("Closes from the home logo even when it points at the current route", async () => {
    dom.window.history.replaceState({}, "", "/");
    const view = await mountMenu();
    const logo = view.container.querySelector('a[aria-label="Citius Holidays home"]');

    await act(async () => logo.click());
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();

    await view.unmount();
  });
});
