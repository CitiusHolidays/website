import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { sanitizeAssistantHtml } from "./sanitizeAssistantHtml.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com",
});

beforeAll(() => {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
});

afterAll(() => {
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
});

describe("sanitizeAssistantHtml", () => {
  test("strips script tags and event handlers", () => {
    const dirty = '<p>Hello</p><script>alert(1)</script><img src=x onerror="alert(1)">';
    const clean = sanitizeAssistantHtml(dirty);
    expect(clean).toContain("<p>Hello</p>");
    expect(clean.toLowerCase()).not.toContain("script");
    expect(clean.toLowerCase()).not.toContain("onerror");
    expect(clean.toLowerCase()).not.toContain("img");
  });

  test("keeps allowlisted formatting tags", () => {
    const html = "<h3>Title</h3><ul><li><strong>One</strong></li></ul>";
    expect(sanitizeAssistantHtml(html)).toBe(html);
  });
});
