import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dir, "page.js"), "utf8");
const INSTANT_RENDERING_DISABLED_PATTERN = /^export const instant = false;/m;

describe("Sacred Bharat legacy edition alias", () => {
  test("opts the request searchParams redirect out of instant prerendering", () => {
    expect(source).toMatch(INSTANT_RENDERING_DISABLED_PATTERN);
    expect(source).toContain("searchParams");
    expect(source).toContain("sacredBharatEditionHref");
  });
});
