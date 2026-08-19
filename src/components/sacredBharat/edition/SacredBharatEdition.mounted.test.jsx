import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { isRuntimeObject, isRuntimeString } from "@/lib/runtimeValues";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://www.citiusholidays.com/sacred-bharat/001?via=0123456789abcdef01234567",
});
let createRoot;
let SacredBharatEdition;

function assetSource(source) {
  if (isRuntimeString(source)) {
    return source;
  }
  return isRuntimeObject(source) && "src" in source && isRuntimeString(source.src)
    ? source.src
    : "";
}

function linkTarget(href) {
  if (isRuntimeString(href)) {
    return href;
  }
  return isRuntimeObject(href) && "pathname" in href && isRuntimeString(href.pathname)
    ? href.pathname
    : "";
}

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 202 })));
  mock.module("next/image", () => ({
    default: ({ alt, src }) => <span aria-label={alt} data-src={assetSource(src)} role="img" />,
  }));
  mock.module("next/link", () => ({
    default: ({ children, href, ...props }) => (
      <a href={linkTarget(href)} {...props}>
        {children}
      </a>
    ),
  }));
  ({ createRoot } = await import("react-dom/client"));
  ({ default: SacredBharatEdition } = await import("./SacredBharatEdition"));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

function buttonWithText(container, text) {
  return [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(text)
  );
}

async function answerQuestion(container, answer, nextLabel) {
  await act(async () => buttonWithText(container, answer)?.click());
  expect(container.textContent).toContain("Recognised");
  await act(async () => buttonWithText(container, nextLabel)?.click());
}

describe("Mounted Sacred Bharat / 001 flow", () => {
  test("starts on the first visual detail and completes without login or a landing gate", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<SacredBharatEdition />));

    expect(container.textContent).toContain("Which river city wakes like this?");
    expect(container.textContent).toContain("No login");
    expect(container.textContent).not.toContain("Start challenge");

    await answerQuestion(container, "Varanasi", "Next detail");
    await answerQuestion(container, "Sri Harmandir Sahib", "Next detail");
    await answerQuestion(container, "Meenakshi Sundareswarar", "Next detail");
    await answerQuestion(container, "Kedarnath", "Next detail");
    await answerQuestion(container, "Sun Temple, Konark", "See my result");

    expect(container.textContent).toContain("5/5");
    expect(container.textContent).toContain("Every detail");
    expect(container.textContent).toContain("Choose your Story treatment");
    expect(container.textContent).toContain("Midnight archive");
    expect(container.textContent).toContain("Temple red");
    expect(container.textContent).toContain("Monsoon green");
    expect(container.textContent).toContain("Invite a friend");
    expect(container.querySelector('a[href="/pilgrimage"]')?.textContent).toContain(
      "Explore pilgrimage journeys"
    );

    await act(async () => root.unmount());
    container.remove();
  });
});
