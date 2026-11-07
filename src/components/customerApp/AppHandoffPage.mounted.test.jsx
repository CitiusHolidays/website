import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

// Synthetic token only.
const TOKEN = "synthetic_Token-0123456789abcdef";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: `https://www.citiusholidays.com/app/invite?ref=mail#token=${TOKEN}`,
});
let AppHandoffPage;
let createRoot;
let renderToStaticMarkup;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  mock.module("next/image", () => ({
    default: ({ alt }) => <span aria-label={alt} role="img" />,
  }));
  ({ createRoot } = await import("react-dom/client"));
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ default: AppHandoffPage } = await import("./AppHandoffPage"));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

async function mount(kind) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<AppHandoffPage kind={kind} />));
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

test("The server page explains the link without a button or an expiry message", () => {
  const markup = renderToStaticMarkup(<AppHandoffPage kind="invite" />);
  expect(markup).toContain("Your trip invite");
  expect(markup).toContain("Open this page on your phone");
  expect(markup).not.toContain("<a ");
  expect(markup).not.toContain("has expired");
});

test("Hands the link's token to the app and clears it from the address bar", async () => {
  const view = await mount("invite");
  const link = view.container.querySelector("a");
  expect(link?.getAttribute("href")).toBe(`citius://invite?token=${TOKEN}`);
  expect(link?.textContent).toBe("Open the invite in the app");
  // The one-time token leaves the address bar and history, along with the query.
  expect(dom.window.location.hash).toBe("");
  expect(dom.window.location.search).toBe("");
  expect(dom.window.location.pathname).toBe("/app/invite");
  await view.unmount();
});

test("A page whose link has no usable token says so", async () => {
  dom.reconfigure({ url: "https://www.citiusholidays.com/app/sign-in#token=short" });
  const view = await mount("sign-in");
  expect(view.container.querySelector("a")).toBeNull();
  expect(view.container.textContent).toContain("This link is incomplete or has expired.");
  expect(dom.window.location.hash).toBe("");
  await view.unmount();

  dom.reconfigure({ url: "https://www.citiusholidays.com/app/sign-in" });
  const bare = await mount("sign-in");
  expect(bare.container.textContent).toContain("This link is incomplete or has expired.");
  await bare.unmount();
});
