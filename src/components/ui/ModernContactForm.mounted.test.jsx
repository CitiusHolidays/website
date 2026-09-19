import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

let createRoot;
let ModernContactForm;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/contact?intent=pilgrimage-callback",
});
const originalFetch = globalThis.fetch;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.FocusEvent = dom.window.FocusEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  dom.window.HTMLElement.prototype.attachEvent = () => undefined;
  dom.window.HTMLElement.prototype.detachEvent = () => undefined;
  ({ createRoot } = await import("react-dom/client"));
  ({ default: ModernContactForm } = await import("./ModernContactForm"));
});

afterAll(() => dom.window.close());

afterEach(() => {
  globalThis.fetch = originalFetch;
  document.body.replaceChildren();
});

function setInputValue(input, value) {
  const prototype =
    input instanceof dom.window.HTMLTextAreaElement
      ? dom.window.HTMLTextAreaElement.prototype
      : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(input, value);
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

describe("Mounted contact intent", () => {
  test("Intent values are visible in the existing form and remain editable", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(() =>
      root.render(
        <ModernContactForm
          initialValues={{
            message: "Please contact me about a Citius pilgrimage programme.",
            subject: "Pilgrimage callback request",
          }}
        />
      )
    );

    const subject = container.querySelector('input[name="subject"]');
    const message = container.querySelector('textarea[name="message"]');
    expect(subject?.value).toBe("Pilgrimage callback request");
    expect(message?.value).toBe("Please contact me about a Citius pilgrimage programme.");

    const valueSetter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype,
      "value"
    ).set;
    await act(() => {
      valueSetter.call(subject, "Edited pilgrimage request");
      subject.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    expect(subject.value).toBe("Edited pilgrimage request");

    await act(() => root.unmount());
    container.remove();
  });

  test("Labels retarget one transform channel across focus, value, and textarea states", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<ModernContactForm />));

    const name = container.querySelector('input[name="name"]');
    const nameLabel = container.querySelector('label[for="name"]');
    const message = container.querySelector('textarea[name="message"]');
    const messageLabel = container.querySelector('label[for="message"]');
    expect(nameLabel.style.transform).toBe("translate3d(0, -50%, 0) scale(1)");
    expect(nameLabel.className).toContain("transition-[color,transform]");
    expect(nameLabel.className).toContain("duration-[160ms]");
    expect(messageLabel.style.transform).toBe("translate3d(0, 0, 0) scale(1)");

    await act(async () => name.focus());
    expect(nameLabel.style.transform).toContain("calc(-50% - 40px)");
    const valueSetter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype,
      "value"
    ).set;
    await act(() => {
      valueSetter.call(name, "A traveller");
      name.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      name.blur();
    });
    expect(nameLabel.style.transform).toContain("calc(-50% - 40px)");

    await act(async () => message.focus());
    expect(messageLabel.style.transform).toBe("translate3d(-8px, -40px, 0) scale(0.85)");
    await act(async () => root.unmount());
    container.remove();
  });

  test("Focuses and describes the first invalid field and announces one correction summary", async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error("must not submit invalid form")));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<ModernContactForm />));

    await act(async () => {
      container
        .querySelector("form")
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const name = container.querySelector('input[name="name"]');
    expect(document.activeElement).toBe(name);
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(name.getAttribute("aria-describedby")).toBe("name-error");
    expect(container.querySelector('[role="status"]').textContent).toBe(
      "Please correct the highlighted fields."
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  test("Creates one consented Website intent with a stable idempotency key before success", async () => {
    const calls = [];
    globalThis.fetch = mock((url, options) => {
      calls.push({ options, url });
      return Promise.resolve(Response.json({ accepted: true }, { status: 201 }));
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<ModernContactForm />));

    await act(() => {
      setInputValue(container.querySelector('input[name="name"]'), "A Traveller");
      setInputValue(container.querySelector('input[name="email"]'), "traveller@example.com");
      setInputValue(container.querySelector('input[name="subject"]'), "Kerala journey");
      setInputValue(container.querySelector('textarea[name="message"]'), "Please contact me.");
      container.querySelector('input[name="consent"]').click();
    });
    await act(async () => {
      container
        .querySelector("form")
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      container
        .querySelector("form")
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/inbound-intents");
    const body = JSON.parse(calls[0].options.body);
    expect(body).toMatchObject({
      clientName: "A Traveller",
      consent: true,
      contactEmail: "traveller@example.com",
      notes: "Subject: Kerala journey\n\nPlease contact me.",
      source: "Website",
    });
    expect(calls[0].options.headers["Idempotency-Key"]).toMatch(UUID_PATTERN);
    expect(container.querySelector('[role="status"]').textContent).toContain(
      "Your enquiry was received"
    );

    await act(async () => root.unmount());
  });

  test("Preserves the enquiry and retry identity after a recoverable gateway failure", async () => {
    const calls = [];
    globalThis.fetch = mock((_url, options) => {
      calls.push(options);
      return Promise.resolve(
        Response.json({ error: "Enquiry service is temporarily unavailable." }, { status: 503 })
      );
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<ModernContactForm />));

    await act(() => {
      setInputValue(container.querySelector('input[name="name"]'), "A Traveller");
      setInputValue(container.querySelector('input[name="email"]'), "traveller@example.com");
      setInputValue(container.querySelector('input[name="subject"]'), "Kerala journey");
      setInputValue(container.querySelector('textarea[name="message"]'), "Please contact me.");
      container.querySelector('input[name="consent"]').click();
    });
    const submit = async () => {
      await act(async () => {
        container
          .querySelector("form")
          .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
        await Promise.resolve();
        await Promise.resolve();
      });
    };
    await submit();

    expect(container.querySelector('input[name="name"]').value).toBe("A Traveller");
    expect(container.querySelector('textarea[name="message"]').value).toBe("Please contact me.");
    expect(container.querySelector('[role="status"]').textContent).toContain(
      "temporarily unavailable"
    );
    await submit();
    expect(calls).toHaveLength(2);
    expect(calls[1].headers["Idempotency-Key"]).toBe(calls[0].headers["Idempotency-Key"]);

    await act(async () => root.unmount());
  });

  test("Does not render an arbitrary enquiry error body", async () => {
    const privateFailure = "gateway secret-value escaped";
    globalThis.fetch = mock(() =>
      Promise.resolve(Response.json({ error: privateFailure }, { status: 502 }))
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<ModernContactForm />));

    await act(() => {
      setInputValue(container.querySelector('input[name="name"]'), "A Traveller");
      setInputValue(container.querySelector('input[name="email"]'), "traveller@example.com");
      setInputValue(container.querySelector('input[name="subject"]'), "Kerala journey");
      setInputValue(container.querySelector('textarea[name="message"]'), "Please contact me.");
      container.querySelector('input[name="consent"]').click();
    });
    await act(async () => {
      container
        .querySelector("form")
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const status = container.querySelector('[role="status"]').textContent;
    expect(status).toContain("Your details are still here");
    expect(status).not.toContain(privateFailure);
    expect(container.querySelector("button[type=submit]").textContent).toContain(
      "Try sending again"
    );

    await act(async () => root.unmount());
  });
});
