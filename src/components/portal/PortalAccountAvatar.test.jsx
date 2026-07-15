import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PortalAccountAvatar } from "./PortalAccountAvatar";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

afterAll(() => dom.window.close());

describe("PortalAccountAvatar", () => {
  test("renders Google profile image when image is present", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <PortalAccountAvatar
          image="https://lh3.googleusercontent.com/a/test-avatar"
          name="Alex Staff"
        />
      )
    );

    const profileImage = container.querySelector('img[alt="Alex Staff profile photo"]');
    expect(profileImage).not.toBeNull();
    expect(profileImage?.getAttribute("src")).toContain("googleusercontent.com");

    await act(async () => root.unmount());
    container.remove();
  });

  test("falls back to UserRound when image is missing", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<PortalAccountAvatar name="Alex Staff" />));

    expect(container.querySelector('img[alt="Alex Staff profile photo"]')).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });
});
