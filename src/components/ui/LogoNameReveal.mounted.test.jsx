import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
let createRoot;
let LogoNameReveal;
let renderedImageProps;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  mock.module("next/image", () => ({
    default: (props) => {
      renderedImageProps = props;
      return <span data-image-test-double="true" />;
    },
  }));
  ({ createRoot } = await import("react-dom/client"));
  ({ default: LogoNameReveal } = await import("./LogoNameReveal"));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

describe("LogoNameReveal", () => {
  test("keeps the partner name available without hover while preserving the logo alt text", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(<LogoNameReveal alt="Partner Name" src="/images/partner-logo.png" />)
    );

    expect(renderedImageProps.alt).toBe("Partner Name");
    expect(renderedImageProps.src).toBe("/images/partner-logo.png");
    expect(container.querySelector("p")?.textContent).toBe("Partner Name");

    await act(async () => root.unmount());
    container.remove();
  });
});
