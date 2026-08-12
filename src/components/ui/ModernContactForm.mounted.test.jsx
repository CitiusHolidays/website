import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import ModernContactForm from "./ModernContactForm";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/contact?intent=pilgrimage-callback",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

afterAll(() => dom.window.close());

describe("mounted contact intent", () => {
  test("intent values are visible in the existing form and remain editable", async () => {
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
});
