import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const APP_ROOT = resolve(import.meta.dir, "../../app");
let PublicRouteError;
let createRoot;

mock.module("next/font/google", () => ({
  Inter: () => ({ variable: "font-inter-variable" }),
  Poppins: () => ({ variable: "font-poppins-variable" }),
}));

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  ({ createRoot } = await import("react-dom/client"));
  ({ default: PublicRouteError } = await import("./PublicRouteError"));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

describe("PublicRouteError", () => {
  test("Offers Try again and a way home, and Try again re-fetches the segment", async () => {
    const retry = mock(() => undefined);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(() => {
      root.render(<PublicRouteError error={new Error("Sanity fetch failed")} retry={retry} />);
    });

    expect(container.querySelector("h1")?.textContent).toBe("This page didn’t load");
    const home = container.querySelector('a[href="/"]');
    expect(home?.textContent).toBe("Back to Citius Holidays");
    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === "Try again"
    );
    expect(button).toBeDefined();
    await act(() => {
      button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
    expect(retry).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Sanity fetch failed");

    await act(() => root.unmount());
    container.remove();
  });

  test("Shows the server digest so support can match logs, never the message", () => {
    const error = Object.assign(new Error("secret upstream detail"), { digest: "1234567890" });
    const html = renderToStaticMarkup(<PublicRouteError error={error} retry={() => undefined} />);
    expect(html).toContain("1234567890");
    expect(html).not.toContain("secret upstream detail");
    expect(renderToStaticMarkup(<PublicRouteError error="boom" />)).not.toContain("Reference");
  });
});

describe("Public error boundaries", () => {
  test("The root, public, and global boundaries are client components wired to retry", () => {
    for (const [file, props] of [
      ["error.js", ""],
      ["(public)/error.js", " underPublicHeader"],
      ["global-error.js", ""],
    ]) {
      const source = readFileSync(resolve(APP_ROOT, file), "utf8");
      expect(source.startsWith('"use client";'), file).toBe(true);
      expect(source, file).toContain(`<PublicRouteError error={error} retry={retry}${props} />`);
    }
  });

  test("Clears the public header only inside the public chrome, and fills the screen otherwise", () => {
    const underHeader = renderToStaticMarkup(
      <PublicRouteError error={null} retry={() => undefined} underPublicHeader />
    );
    const standalone = renderToStaticMarkup(
      <PublicRouteError error={null} retry={() => undefined} />
    );
    expect(underHeader).toContain("bg-public-night");
    expect(underHeader).toContain("pt-36");
    expect(underHeader).not.toContain("min-h-dvh");
    expect(standalone).toContain("min-h-dvh");
    expect(standalone).not.toContain("pt-36");
  });

  test("The global boundary renders its own document with styles, fonts, and a title", async () => {
    const { default: GlobalError } = await import("../../app/global-error.js");
    const html = renderToStaticMarkup(<GlobalError error={new Error("layout")} retry={() => 0} />);
    expect(html).toStartWith('<html class="font-poppins-variable" lang="en">');
    expect(html).toContain('<body class="font-inter-variable bg-public-night');
    expect(html).toContain("<title>Something went wrong | Citius Holidays</title>");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/"');
  });
});
