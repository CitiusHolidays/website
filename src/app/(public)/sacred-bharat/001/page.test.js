import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dir, "page.js"), "utf8");

describe("Sacred Bharat legacy edition alias", () => {
  test("opts the request searchParams redirect out of instant prerendering", () => {
    expect(source).toMatch(/^export const instant = false;/m);
    expect(source).toContain("searchParams");
    expect(source).toContain("sacredBharatEditionHref");
  });
});
