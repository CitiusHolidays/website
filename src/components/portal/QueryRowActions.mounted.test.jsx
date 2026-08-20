import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";

let QueryRowActions;
let PortalActionMenu;

function renderIneligibleTrigger(props) {
  return (
    <button {...props} type="button">
      Ineligible trigger
    </button>
  );
}

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/queries",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Element = dom.window.Element;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.Event = dom.window.Event;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  ({ QueryRowActions } = await import("./QueryRowActions"));
  ({ PortalActionMenu } = await import("./PortalActionMenu"));
});

afterAll(() => dom.window.close());

async function press(button) {
  await act(async () => {
    button?.focus();
    button?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

async function primaryPointer(button) {
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    button?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    button?.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }));
    button?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("QueryRowActions", () => {
  test("Opens an anchored menu with aria-haspopup menu and closes on Escape", async () => {
    let overflowClicked = false;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const handleOverflowClick = () => {
      overflowClicked = true;
    };

    await act(async () =>
      root.render(
        <QueryRowActions
          label="Q-1001"
          overflowActions={[
            <button aria-label="Edit query" key="edit" onClick={handleOverflowClick} type="button">
              Edit
            </button>,
          ]}
          primaryAction={
            <button aria-label="Open query" type="button">
              Open
            </button>
          }
        />
      )
    );

    const moreButton = container.querySelector('button[aria-label="More actions for Q-1001"]');
    expect(moreButton?.getAttribute("aria-haspopup")).toBe("menu");
    expect(container.querySelector('[role="menu"]')).toBeNull();

    await press(moreButton);
    expect(moreButton?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(container.querySelector("dialog")).toBeNull();
    const visiblePopup = document.querySelector('[data-slot="portal-action-menu-popup"]');
    expect(visiblePopup?.className).toContain("opacity-100");
    expect(visiblePopup?.className).not.toContain("data-[starting-style]:opacity-0");
    expect(visiblePopup?.className).not.toContain("data-[ending-style]:opacity-0");
    expect(visiblePopup?.className).not.toContain("data-[starting-style]:scale-");
    expect(visiblePopup?.className).not.toContain("data-[ending-style]:scale-");
    expect(visiblePopup?.className).toContain("duration-150");
    expect(visiblePopup?.className).toContain("motion-reduce:!transition-none");
    visiblePopup?.setAttribute("data-starting-style", "");
    expect(visiblePopup?.style.display).not.toBe("none");
    expect(visiblePopup?.style.opacity).toBe("1");
    expect(visiblePopup?.style.transform).toBe("translateY(0) scale(1)");
    expect(visiblePopup?.style.transition).not.toBe("none");
    expect(visiblePopup?.style.transition).toContain("150ms");
    for (const selector of [
      '[data-slot="portal-action-menu-backdrop"]',
      '[data-slot="portal-action-menu-positioner"]',
      '[data-slot="portal-action-menu-popup"]',
    ]) {
      const layer = document.querySelector(selector);
      expect(layer).not.toBeNull();
      expect(layer?.className).toContain("data-[closed]:pointer-events-none");
    }
    expect(
      document.querySelector('[data-slot="portal-action-menu-backdrop"]')?.className
    ).toContain("data-[closed]:hidden");

    const backdrop = [...document.querySelectorAll("button")].find(
      (button) => button.getAttribute("aria-label") === "Close More actions for Q-1001"
    );
    await act(async () => {
      backdrop?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      backdrop?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(moreButton?.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(moreButton);

    await press(moreButton);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
      await new Promise((resolve) => setTimeout(resolve, 180));
    });
    expect(moreButton?.getAttribute("aria-expanded")).toBe("false");
    const retainedBackdrop = document.querySelector('[data-slot="portal-action-menu-backdrop"]');
    const retainedPositioner = document.querySelector(
      '[data-slot="portal-action-menu-positioner"]'
    );
    const retainedPopup = document.querySelector('[data-slot="portal-action-menu-popup"]');
    if (retainedBackdrop) {
      expect(retainedBackdrop.getAttribute("data-closed")).not.toBeNull();
      expect(retainedBackdrop.className).toContain("data-[closed]:hidden");
    }
    if (retainedPositioner) {
      expect(retainedPositioner.className).toContain("data-[closed]:pointer-events-none");
    }
    if (retainedPopup) {
      expect(retainedPopup.getAttribute("data-closed")).not.toBeNull();
      expect(retainedPopup.style.display).toBe("none");
      expect(retainedPopup.style.opacity).toBe("0");
      expect(retainedPopup.style.pointerEvents).toBe("none");
      expect(retainedPopup.style.transition).toContain("120ms");
      expect(retainedPopup.className).toContain("data-[closed]:pointer-events-none");
    }

    await press(moreButton);
    const editItem = document.querySelector('[role="menuitem"][aria-label="Edit query"]');
    await act(async () => {
      editItem?.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(overflowClicked).toBe(true);
    expect(moreButton?.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(moreButton);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Keeps every overflow action reachable from the mobile More menu", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <QueryRowActions
          label="Q-2002"
          overflowActions={[
            <button aria-label="Edit query" key="edit" type="button">
              Edit query
            </button>,
            <button aria-label="Share query" key="share" type="button">
              Share query
            </button>,
            <button aria-label="Delete query" key="delete" type="button">
              Delete query
            </button>,
          ]}
          primaryAction={
            <button aria-label="Open query" type="button">
              Open
            </button>
          }
        />
      )
    );

    const moreButtons = container.querySelectorAll('button[aria-label="More actions for Q-2002"]');
    expect(moreButtons.length).toBe(2);
    const mobileActions = container.querySelector('[data-slot="mobile-query-actions"]');
    expect(mobileActions?.className).toContain("flex-wrap");
    expect(mobileActions?.textContent).not.toContain("Swipe");
    expect(mobileActions?.querySelectorAll("button").length).toBe(2);
    expect(mobileActions?.querySelector('[aria-label="Open query"]')).not.toBeNull();
    expect(mobileActions?.querySelector('[aria-label="More actions for Q-2002"]')).not.toBeNull();

    await press(moreButtons.item(1));
    const menuItems = [...document.querySelectorAll('[role="menuitem"]')];
    expect(menuItems.map((item) => item.getAttribute("aria-label"))).toEqual([
      "Edit query",
      "Share query",
      "Delete query",
    ]);

    await act(async () => {
      menuItems[0]?.focus();
      menuItems[0]?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "s" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Share query");

    await act(async () => root.unmount());
    container.remove();
  });

  test("Opens the controlled desktop and mobile menus from a full primary-pointer sequence", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <QueryRowActions
          label="Q-3003"
          overflowActions={[
            <button aria-label="Edit query" key="edit" type="button">
              Edit query
            </button>,
          ]}
          primaryAction={
            <button aria-label="Sales Decision" type="button">
              Sales Decision
            </button>
          }
        />
      )
    );

    const moreButtons = container.querySelectorAll('button[aria-label="More actions for Q-3003"]');
    expect(moreButtons.length).toBe(2);
    await Array.from(moreButtons).reduce(async (previous, moreButton) => {
      await previous;
      expect(moreButton.getAttribute("aria-expanded")).toBe("false");
      await primaryPointer(moreButton);
      expect(moreButton.getAttribute("aria-expanded")).toBe("true");
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(moreButton.getAttribute("aria-expanded")).toBe("false");
    }, Promise.resolve());

    await act(async () => root.unmount());
    container.remove();
  });

  test("Skips outside-focus compatibility when the trigger is no longer eligible", async () => {
    function IneligibleTriggerMenu() {
      const [open, setOpen] = useState(false);
      return (
        <PortalActionMenu
          aria-label="Ineligible test menu"
          onOpenChange={setOpen}
          open={open}
          trigger={renderIneligibleTrigger}
        >
          <button type="button">Only action</button>
        </PortalActionMenu>
      );
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<IneligibleTriggerMenu />));

    const trigger = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Ineligible trigger"
    );
    await primaryPointer(trigger);
    trigger?.remove();
    expect(trigger?.isConnected).toBe(false);
    const backdrop = document.querySelector('button[aria-label="Close Ineligible test menu"]');
    await act(async () => {
      backdrop?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
      backdrop?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).not.toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });
});
