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
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
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
  test("Preserves profile edit, validation, and cancel controls", async () => {
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

  test("Marks profile saving as busy without changing save copy", async () => {
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

  test("Keeps edits and renders stable recovery copy for unknown profile failures", async () => {
    const privateFailure = "database secret-value escaped";
    globalThis.fetch = mock(() =>
      Promise.resolve(Response.json({ error: privateFailure }, { status: 500 }))
    );
    const view = await mount(<AccountProfilePanel user={user} />);

    await act(async () =>
      [...view.container.querySelectorAll("button")]
        .find((button) => button.textContent === "Edit Details")
        .click()
    );
    await act(async () => {
      [...view.container.querySelectorAll("button")]
        .find((button) => button.textContent === "Save Changes")
        .click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const alert = view.container.querySelector('[role="alert"]')?.textContent;
    expect(alert).toContain("Your changes are still here");
    expect(alert).not.toContain(privateFailure);
    expect(view.container.querySelector('input[placeholder="Enter your full name"]')?.value).toBe(
      user.name
    );

    await view.unmount();
  });
});

describe("AccountSettingsPanel", () => {
  test("Separates planned settings from the actionable account contact", async () => {
    const view = await mount(<AccountSettingsPanel />);

    expect(view.container.textContent).toContain("Account Settings");
    expect(view.container.querySelector('[role="switch"]')).toBeNull();
    expect(view.container.querySelector("button")).toBeNull();
    const plannedStatuses = [...view.container.querySelectorAll("span")].filter(
      (node) => node.textContent === "Planned"
    );
    expect(plannedStatuses).toHaveLength(1);
    expect(plannedStatuses.map((status) => status.getAttribute("aria-label"))).toEqual([
      "Two-step verification. Planned",
    ]);
    const perJourney = [...view.container.querySelectorAll("span")].find(
      (node) => node.textContent === "Per journey"
    );
    expect(perJourney?.getAttribute("aria-label")).toBe("Journey reminders. Per journey");
    expect(view.container.textContent).toContain("Choose reminder milestones on each Arrival Pack");
    const contact = view.container.querySelector('a[href="/contact?intent=account-deletion"]');
    expect(contact?.textContent).toBe("Contact team");
    expect(contact?.getAttribute("aria-label")).toBe(
      "Contact the Citius team about deleting your account"
    );
    expect(contact?.className).toContain("min-h-11");

    await view.unmount();
  });

  test("Routes the Account switch through the shared thumb for click and Space", async () => {
    const view = await mount(<Toggle label="Trip alerts" />);
    const toggle = view.container.querySelector('[role="switch"]');
    expect(toggle.getAttribute("aria-label")).toBe("Trip alerts: On");
    expect(toggle.className).toContain("h-6");
    expect(toggle.className).toContain("w-11");
    expect(toggle.className).toContain("duration-150");
    const thumb = toggle.querySelector("span");
    expect(thumb?.className).toContain("size-4");
    expect(thumb?.className).toContain("data-[checked]:translate-x-5");
    expect(thumb?.className).toContain("duration-150");

    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-label")).toBe("Trip alerts: Off");
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    await act(() => {
      toggle.focus();
      toggle.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " }));
      toggle.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: " " }));
    });
    expect(toggle.getAttribute("aria-label")).toBe("Trip alerts: On");
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    await view.unmount();
  });

  test("Keeps disabled Account switches inert when a persisted control is unavailable", async () => {
    const view = await mount(<Toggle disabled label="Trip alerts" />);
    const toggle = view.container.querySelector('[role="switch"]');
    expect(toggle.getAttribute("aria-label")).toBe("Trip alerts: On. Planned");
    expect(toggle.getAttribute("aria-disabled")).toBe("true");
    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    await view.unmount();
  });
});
