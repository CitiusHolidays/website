// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks are intentionally local to the harness.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";

let AccountControl;
let NavButton;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/account",
});

const handleLogout = () => undefined;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  ({ AccountControl } = await import("./AccountSidebar"));
  ({ NavButton } = await import("./AccountUi"));
});

afterEach(() => {
  document.body.replaceChildren();
});

afterAll(() => dom.window.close());

async function openWithKeyboard(trigger) {
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

async function openWithPointer(trigger) {
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    trigger.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }));
    trigger.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("AccountControl", () => {
  test("renders the Google profile photo and a route back to the main site", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <AccountControl
          isLoggingOut={false}
          onLogout={handleLogout}
          user={{
            email: "traveller@example.com",
            image: "https://lh3.googleusercontent.com/a/google-profile-photo",
            name: "Test Traveller",
          }}
        />
      )
    );

    const profilePhoto = container.querySelector('img[alt="Test Traveller profile photo"]');
    expect(profilePhoto).not.toBeNull();
    expect(profilePhoto.getAttribute("src")).toContain("lh3.googleusercontent.com");

    const trigger = container.querySelector('button[aria-label="Open account menu"]');
    expect(trigger.className).toContain("rounded-full");
    expect(trigger.className).toContain("border-[var(--account-border)]");
    expect(trigger.className).toContain("bg-[var(--account-surface)]");
    expect(trigger.className).toContain("px-2");
    expect(trigger.className).toContain("py-1.5");
    await openWithPointer(trigger);

    const menuItems = [...document.querySelectorAll('[role="menuitem"]')];
    expect(menuItems.map((item) => item.textContent.trim())).toEqual([
      "Back to main site",
      "Sign out",
    ]);
    const mainSiteLink = document.querySelector('[role="menuitem"][href="/"]');
    expect(mainSiteLink).not.toBeNull();
    expect(mainSiteLink.textContent).toContain("Back to main site");

    const popup = document.querySelector('[data-slot="portal-action-menu-popup"]');
    expect(popup?.className).toContain("w-60");
    expect(popup?.className).toContain("rounded-xl");
    expect(popup?.className).toContain("border-[var(--account-border)]");
    expect(popup?.className).toContain("bg-[var(--account-surface)]");
    expect(popup?.className).toContain("p-3");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
      await new Promise((resolve) => setTimeout(resolve, 180));
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
  });

  test("opens from the keyboard and closes an activated item onto the exact trigger", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <AccountControl
          isLoggingOut={false}
          onLogout={handleLogout}
          user={{ email: "traveller@example.com", name: "Test Traveller" }}
        />
      )
    );

    const trigger = container.querySelector('button[aria-label="Open account menu"]');
    await openWithKeyboard(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const mainSiteLink = document.querySelector('[role="menuitem"][href="/"]');
    mainSiteLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await act(async () => {
      mainSiteLink.click();
      await new Promise((resolve) => setTimeout(resolve, 180));
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
  });

  test("keeps the menu visible while logout enters its pending state", async () => {
    function LogoutHarness() {
      const [isLoggingOut, setIsLoggingOut] = useState(false);
      return (
        <AccountControl
          isLoggingOut={isLoggingOut}
          onLogout={() => setIsLoggingOut(true)}
          user={{ email: "traveller@example.com", name: "Test Traveller" }}
        />
      );
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<LogoutHarness />));

    const trigger = container.querySelector('button[aria-label="Open account menu"]');
    await openWithPointer(trigger);
    const logoutButton = [...document.querySelectorAll('[role="menuitem"]')].find((item) =>
      item.textContent.includes("Sign out")
    );
    await act(async () => {
      logoutButton.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const pendingLogout = [...document.querySelectorAll('[role="menuitem"]')].find((item) =>
      item.textContent.includes("Signing out…")
    );
    expect(pendingLogout.getAttribute("aria-disabled")).toBe("true");
    expect(pendingLogout.hasAttribute("data-disabled")).toBe(true);
    expect(pendingLogout.getAttribute("aria-busy")).toBe("true");

    await act(async () => root.unmount());
  });

  test("closes an outside press onto the exact trigger", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <AccountControl
          isLoggingOut={false}
          onLogout={handleLogout}
          user={{ email: "traveller@example.com", name: "Test Traveller" }}
        />
      )
    );

    const trigger = container.querySelector('button[aria-label="Open account menu"]');
    await openWithPointer(trigger);
    const backdrop = document.querySelector('[data-slot="portal-action-menu-backdrop"]');
    expect(backdrop).not.toBeNull();

    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
      backdrop.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
  });

  test("keeps logout explicit and exposes its pending state", async () => {
    let logoutCalls = 0;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <AccountControl
          isLoggingOut
          onLogout={() => {
            logoutCalls += 1;
          }}
          user={{ email: "traveller@example.com", name: "Test Traveller" }}
        />
      )
    );

    await openWithPointer(container.querySelector('button[aria-label="Open account menu"]'));
    const logoutButton = [...document.querySelectorAll('[role="menuitem"]')].find((item) =>
      item.textContent.includes("Signing out…")
    );

    expect(logoutButton).not.toBeNull();
    expect(logoutButton.getAttribute("aria-disabled")).toBe("true");
    expect(logoutButton.hasAttribute("data-disabled")).toBe(true);
    expect(logoutButton.getAttribute("aria-busy")).toBe("true");
    await act(async () => logoutButton.click());
    expect(logoutCalls).toBe(0);

    await act(async () => root.unmount());
  });
});

describe("Account navigation", () => {
  test("preserves selected-tab semantics and callbacks across navigation recipes", async () => {
    const tabChanges = [];
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <nav aria-label="Account navigation">
          <NavButton
            active
            header
            icon={<span aria-hidden="true">J</span>}
            label="Journeys"
            onClick={() => tabChanges.push("journeys")}
          />
          <NavButton
            active={false}
            icon={<span aria-hidden="true">P</span>}
            label="Profile"
            mobile
            onClick={() => tabChanges.push("profile")}
          />
        </nav>
      )
    );

    const navigation = container.querySelector('nav[aria-label="Account navigation"]');
    expect(navigation.textContent).toContain("Journeys");
    expect(navigation.textContent).toContain("Profile");
    expect(navigation.querySelector('button[aria-current="page"]')?.textContent).toContain(
      "Journeys"
    );

    const profileButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Profile")
    );
    await act(async () => profileButton.click());
    expect(tabChanges).toEqual(["profile"]);

    await act(async () => root.unmount());
  });
});
