import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

let createRoot;
let AccountProfilePanel;
const originalFetch = globalThis.fetch;
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/account",
});
const user = {
  email: "avery@example.invalid",
  hasPassportDetails: true,
  name: "Avery Rao",
  phoneNumber: "+1 555-123-4567",
};

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  dom.window.HTMLElement.prototype.attachEvent = () => undefined;
  dom.window.HTMLElement.prototype.detachEvent = () => undefined;
  ({ createRoot } = await import("react-dom/client"));
  ({ AccountProfilePanel } = await import("./AccountProfilePanel"));
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  document.body.replaceChildren();
});
afterAll(() => dom.window.close());

async function mount(initialUser = user) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => root.render(<AccountProfilePanel user={initialUser} />));
  return {
    button: (name) => [...container.querySelectorAll("button")].find((b) => b.textContent === name),
    container,
    input: (name) => container.querySelector(`input[name="${name}"]`),
    rerender: (nextUser) => act(() => root.render(<AccountProfilePanel user={nextUser} />)),
    submit: () =>
      container
        .querySelector("form")
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    async unmount() {
      await act(() => root.unmount());
      container.remove();
    },
  };
}

function edit(input, value) {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
    input,
    value
  );
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

describe("Account profile editing", () => {
  test("Opens the latest displayed values, preserves an active draft on refresh, and cancels explicitly", async () => {
    globalThis.fetch = mock();
    const view = await mount();
    await view.rerender({ ...user, name: "Avery Rao Updated", phoneNumber: "+1 555-222-3333" });
    await act(() => view.button("Edit Details").click());
    expect(view.input("name").value).toBe("Avery Rao Updated");
    expect(view.input("phoneNumber").value).toBe("+1 555-222-3333");
    await act(() => edit(view.input("name"), "My unsaved name"));
    await view.rerender({ ...user, name: "A newer server value" });
    expect(view.input("name").value).toBe("My unsaved name");
    await act(() => view.button("Cancel").click());
    expect(view.input("name")).toBeNull();
    await act(() => view.button("Edit Details").click());
    expect(view.input("name").value).toBe("A newer server value");
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await view.unmount();
  });

  test("Keeps the existing validation and focuses the invalid name or optional phone", async () => {
    globalThis.fetch = mock();
    const view = await mount({ ...user, name: "A" });
    await act(() => view.button("Edit Details").click());
    await act(() => view.submit());
    expect(document.activeElement).toBe(view.input("name"));
    expect(view.container.textContent).toContain("at least 2 characters");
    await act(() => edit(view.input("name"), "A".repeat(81)));
    await act(() => view.submit());
    expect(view.container.textContent).toContain("under 80 characters");
    await act(() => {
      edit(view.input("name"), "Avery Rao");
      edit(view.input("phoneNumber"), "123");
    });
    await act(() => view.submit());
    expect(document.activeElement).toBe(view.input("phoneNumber"));
    expect(view.container.textContent).toContain("valid phone number");
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(view.container.querySelector('input[value="avery@example.invalid"]').disabled).toBe(
      true
    );
    await view.unmount();
  });

  test("Submits once, protects a pending save, retains failed edits, and retries the same API contract", async () => {
    let finish;
    globalThis.fetch = mock(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const view = await mount();
    await act(() => view.submit());
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await act(() => view.button("Edit Details").click());
    await act(() => {
      edit(view.input("name"), "  Avery Sen  ");
      edit(view.input("phoneNumber"), "");
    });
    await act(() => {
      view.submit();
      view.submit();
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(view.button("Cancel").disabled).toBe(true);
    expect(view.button("Saving…").disabled).toBe(true);
    expect(view.input("name").disabled).toBe(true);
    expect(view.input("phoneNumber").disabled).toBe(true);
    await act(() => view.button("Cancel").click());
    await act(async () => {
      finish(Response.json({ error: "internal detail" }, { status: 503 }));
      await Promise.resolve();
    });
    expect(view.input("name").value).toBe("  Avery Sen  ");
    expect(view.input("name").disabled).toBe(false);
    expect(view.button("Cancel").disabled).toBe(false);
    expect(view.container.textContent).toContain("Your changes are still here");
    expect(view.container.textContent).not.toContain("internal detail");
    await act(() => view.button("Save Changes").click());
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    for (const [url, options] of globalThis.fetch.mock.calls) {
      expect(url).toBe("/api/profile");
      expect(options.method).toBe("PUT");
      expect(JSON.parse(options.body)).toEqual({ name: "Avery Sen", phoneNumber: "" });
    }
    await act(async () => {
      finish(Response.json({ user: { ...user, name: "Avery Sen", phoneNumber: "" } }));
      await Promise.resolve();
    });
    expect(view.input("name")).toBeNull();
    expect(view.container.textContent).toContain("Avery Sen");
    expect(view.container.textContent).toContain("Not provided");
    expect(view.container.textContent).toContain("Passport details on file");
    await view.unmount();
  });
});
