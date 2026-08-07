import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AccountProfilePanel } from "./AccountProfilePanel";
import { AccountSettingsPanel } from "./AccountSettingsPanel";
import { Toggle } from "./AccountUi";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/account",
});

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
  mock.restore();
});

afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const user = {
  createdAt: "2025-04-02T12:00:00.000Z",
  email: "traveller@example.com",
  hasPassportDetails: true,
  name: "Test Traveller",
  phoneNumber: "+1 555-123-4567",
};

describe("AccountProfilePanel", () => {
  test("preserves profile edit, validation, and cancel controls", async () => {
    const view = await mount(<AccountProfilePanel user={{ ...user, name: "T" }} />);

    expect(view.container.textContent).toContain("Personal Details");
    expect(view.container.textContent).toContain("Passport details on file");
    await act(async () =>
      [...view.container.querySelectorAll("button")]
        .find((button) => button.textContent === "Edit Details")
        .click()
    );

    const fullName = view.container.querySelector('input[placeholder="Enter your full name"]');
    const email = view.container.querySelector('input[value="traveller@example.com"]');
    expect(fullName).not.toBeNull();
    expect(view.container.querySelector(`label[for="${fullName.id}"]`)?.textContent).toBe(
      "Full Name"
    );
    expect(fullName.className).toContain("account-focus");
    expect(email.disabled).toBe(true);

    await act(async () =>
      [...view.container.querySelectorAll("button")]
        .find((button) => button.textContent === "Save Changes")
        .click()
    );
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
      "Please enter your full name"
    );

    await act(async () =>
      [...view.container.querySelectorAll("button")]
        .find((button) => button.textContent === "Cancel")
        .click()
    );
    expect(view.container.querySelector('input[placeholder="Enter your full name"]')).toBeNull();
    expect(view.container.textContent).toContain("T");

    await view.unmount();
  });

  test("marks profile saving as busy without changing save copy", async () => {
    let resolveFetch;
    globalThis.fetch = mock(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    const view = await mount(<AccountProfilePanel user={user} />);

    await act(async () =>
      [...view.container.querySelectorAll("button")]
        .find((button) => button.textContent === "Edit Details")
        .click()
    );
    const saveButton = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Save Changes")
    );
    await act(async () => saveButton.click());

    const savingButton = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Saving…")
    );
    expect(savingButton.disabled).toBe(true);
    expect(savingButton.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      resolveFetch({
        json: async () => ({ user }),
        ok: true,
      });
      await Promise.resolve();
    });
    expect(view.container.querySelector('[role="status"]')?.textContent).toContain(
      "Profile updated successfully."
    );

    await view.unmount();
  });
});

describe("AccountSettingsPanel", () => {
  test("preserves planned and contact-only settings as non-interactive controls", async () => {
    const view = await mount(<AccountSettingsPanel />);

    expect(view.container.textContent).toContain("Account Settings");
    const notifications = view.container.querySelector('[role="switch"]');
    expect(notifications.getAttribute("aria-disabled")).toBe("true");
    expect(notifications.nextElementSibling?.disabled).toBe(true);
    expect(notifications.getAttribute("aria-label")).toBe("Email notifications: On. Planned");

    const plannedButton = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Planned"
    );
    expect(plannedButton.disabled).toBe(true);
    expect(view.container.textContent).toContain("Contact team");

    await view.unmount();
  });

  test("keeps the Account switch controlled copy and Motion thumb behavior", async () => {
    const view = await mount(<Toggle label="Trip alerts" />);
    const toggle = view.container.querySelector('[role="switch"]');
    expect(toggle.getAttribute("aria-label")).toBe("Trip alerts: On");
    expect(toggle.className).toContain("h-6");
    expect(toggle.className).toContain("w-11");
    expect(toggle.querySelector("div")?.className).toContain("size-4");

    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-label")).toBe("Trip alerts: Off");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.querySelector("div")?.className).toContain("rounded-full");

    await view.unmount();
  });
});
