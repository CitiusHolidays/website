import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AccountControl } from "./AccountSidebar";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/account",
});

const handleLogout = () => undefined;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
});

afterEach(() => {
  document.body.replaceChildren();
});

afterAll(() => dom.window.close());

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
    await act(async () => trigger.click());

    const mainSiteLink = container.querySelector('[role="menuitem"][href="/"]');
    expect(mainSiteLink).not.toBeNull();
    expect(mainSiteLink.textContent).toContain("Back to main site");

    await act(async () => root.unmount());
  });
});
