import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import TurnstileWidget from "./TurnstileWidget";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com",
});
const noop = () => undefined;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
});

afterAll(() => dom.window.close());

describe("TurnstileWidget", () => {
  test("keeps bot protection out of the layout until Cloudflare requires interaction", async () => {
    let renderOptions;
    window.turnstile = {
      remove: () => undefined,
      render: (_container, options) => {
        renderOptions = options;
        return "widget-id";
      },
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <TurnstileWidget appearance="interaction-only" onVerify={noop} siteKey="test-site-key" />
      )
    );

    expect(renderOptions).toMatchObject({
      appearance: "interaction-only",
      sitekey: "test-site-key",
      theme: "auto",
    });
    expect(container.querySelector("fieldset")?.className).not.toContain("min-h-[65px]");

    await act(async () => root.unmount());
    container.remove();
  });
});
