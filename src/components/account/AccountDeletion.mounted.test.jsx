import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

// React DOM decides which input events to listen for when it loads, so it must load after the
// DOM globals exist.
let createRoot;
let AccountDeletionSection;
let AccountSettingsPanel;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/account",
});
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  dom.window.HTMLElement.prototype.attachEvent = () => undefined;
  dom.window.HTMLElement.prototype.detachEvent = () => undefined;
  ({ createRoot } = await import("react-dom/client"));
  ({ AccountDeletionSection } = await import("./AccountDeletionSection"));
  ({ AccountSettingsPanel } = await import("./AccountSettingsPanel"));
});

afterEach(() => {
  document.body.replaceChildren();
  globalThis.fetch = originalFetch;
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

function json(body, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, status })
  );
}

function type(input, value) {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
    input,
    value
  );
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function button(container, name) {
  return [...container.querySelectorAll("button")].find((node) => node.textContent === name);
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function open(container) {
  await act(async () => button(container, "Delete my account").click());
  await settle();
}

describe("Account deletion", () => {
  test("Settings ends with a self-service deletion row instead of a contact link", async () => {
    const view = await mount(<AccountSettingsPanel />);

    expect(view.container.querySelector('a[href^="/contact"]')).toBeNull();
    const section = view.container.querySelector("#delete-account");
    expect(section?.textContent).toContain("Delete my account");
    const trigger = button(view.container, "Delete my account");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(trigger?.className).toContain("min-h-11");

    await view.unmount();
  });

  test("Explains what is deleted and kept, then deletes only after the typed confirmation", async () => {
    globalThis.fetch = mock((_url, options) =>
      options?.method === "POST"
        ? json({ deletedAt: 1, reference: "ABCDEF0123456789", status: "deleted" })
        : json({ reauthenticateBy: Date.now() + 600_000, status: "ready" })
    );
    const signOut = mock(() => Promise.resolve());
    const view = await mount(<AccountDeletionSection signOut={signOut} />);

    await open(view.container);
    const text = view.container.textContent;
    expect(text).toContain("What we delete");
    expect(text).toContain("Your login and every signed-in device, including Google sign-in");
    expect(text).toContain("Sacred Bharat profile");
    expect(text).toContain("What we keep");
    expect(text).toContain("for 8 years");
    expect(text).toContain("This can't be undone.");

    const input = view.container.querySelector('input[name="confirmation"]');
    const submit = button(view.container, "Delete my account permanently");
    expect(submit.disabled).toBe(true);
    await act(async () => type(input, "delete"));
    expect(submit.disabled).toBe(true);
    await act(async () => type(input, "DELETE"));
    expect(submit.disabled).toBe(false);

    await act(async () => submit.click());
    await settle();

    const post = globalThis.fetch.mock.calls.find(([, options]) => options?.method === "POST");
    expect(post[0]).toBe("/api/account/deletion");
    expect(JSON.parse(post[1].body)).toEqual({ confirmation: "DELETE" });
    expect(signOut).toHaveBeenCalledTimes(1);
    const status = view.container.querySelector('[role="status"]');
    expect(status?.textContent).toContain("Your account was deleted");
    expect(view.container.textContent).toContain("ABCDEF0123456789");
    expect(view.container.querySelector('a[href="/"]')?.textContent).toBe("Return to home");
    expect(view.container.querySelector('input[name="confirmation"]')).toBeNull();

    await view.unmount();
  });

  test("Tells a staff login to contact HR and offers no deletion form", async () => {
    globalThis.fetch = mock(() => json({ status: "staff_account" }));
    const view = await mount(<AccountDeletionSection />);

    await open(view.container);

    expect(view.container.textContent).toContain("Contact HR");
    expect(view.container.querySelector('input[name="confirmation"]')).toBeNull();
    expect(button(view.container, "Delete my account permanently")).toBeUndefined();

    await view.unmount();
  });

  test("Asks for a fresh sign-in and signs out before sending the person to sign in", async () => {
    globalThis.fetch = mock(() => json({ status: "reauthentication_required" }));
    const order = [];
    const signOut = mock(() => {
      order.push("signOut");
      return Promise.resolve();
    });
    const navigate = mock((href) => order.push(href));
    const view = await mount(<AccountDeletionSection navigate={navigate} signOut={signOut} />);

    await open(view.container);
    expect(view.container.textContent).toContain("sign in again");
    expect(view.container.querySelector('input[name="confirmation"]')).toBeNull();

    await act(async () => button(view.container, "Sign in again").click());
    await settle();
    expect(order).toEqual(["signOut", "/auth/guest"]);

    await view.unmount();
  });

  test("Keeps the form and explains a failure; a stale sign-in switches to the sign-in prompt", async () => {
    let attempt = 0;
    globalThis.fetch = mock((_url, options) => {
      if (options?.method !== "POST") {
        return json({ reauthenticateBy: Date.now() + 600_000, status: "ready" });
      }
      attempt += 1;
      return attempt === 1
        ? json(
            {
              code: "unavailable",
              error:
                "We couldn't delete your account just now. Nothing was changed. Please try again.",
            },
            500
          )
        : json(
            {
              code: "reauthentication_required",
              error:
                "For your security, sign in again, then delete your account within 10 minutes.",
            },
            401
          );
    });
    const view = await mount(<AccountDeletionSection />);
    await open(view.container);
    const input = view.container.querySelector('input[name="confirmation"]');
    await act(async () => type(input, "DELETE"));

    await act(async () => button(view.container, "Delete my account permanently").click());
    await settle();
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
      "Nothing was changed"
    );
    expect(view.container.querySelector('input[name="confirmation"]')?.value).toBe("DELETE");

    await act(async () => button(view.container, "Delete my account permanently").click());
    await settle();
    expect(button(view.container, "Sign in again")).toBeDefined();
    expect(view.container.querySelector('input[name="confirmation"]')).toBeNull();

    await view.unmount();
  });

  test("Cancel closes the panel and returns focus to the trigger", async () => {
    globalThis.fetch = mock(() =>
      json({ reauthenticateBy: Date.now() + 600_000, status: "ready" })
    );
    const view = await mount(<AccountDeletionSection />);
    await open(view.container);
    const trigger = button(view.container, "Delete my account");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(trigger.getAttribute("aria-controls"));
    expect(panel).not.toBeNull();

    await act(async () => button(view.container, "Cancel").click());

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(view.container.textContent).not.toContain("What we keep");
    expect(document.activeElement).toBe(trigger);

    await view.unmount();
  });
});
