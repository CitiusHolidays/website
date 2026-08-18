import { describe, expect, test } from "bun:test";
import { isSafePublicWebHref, safePublicHref } from "./publicHref.js";

describe("Public content hrefs", () => {
  test("Keeps relative and approved external links", () => {
    expect(safePublicHref("/blog/citius")).toBe("/blog/citius");
    expect(safePublicHref("https://example.com/travel")).toBe("https://example.com/travel");
    expect(safePublicHref("mailto:hello@example.com")).toBe("mailto:hello@example.com");
    expect(isSafePublicWebHref("#section")).toBe(true);
  });

  test("Rejects script, data, and protocol-relative links", () => {
    expect(safePublicHref("javascript:alert(1)")).toBeNull();
    expect(safePublicHref("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safePublicHref("//attacker.example/phish")).toBeNull();
    expect(safePublicHref("/\\\\attacker.example/phish")).toBeNull();
    expect(safePublicHref("/%5C%5Cattacker.example/phish")).toBeNull();
    expect(safePublicHref("https://example.com/%0Ajavascript:alert(1)")).toBeNull();
  });
});
