import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dir, "page.js"), "utf8");
const DYNAMIC_PARAMS_PATTERN = /^export const dynamicParams\s*=/m;

describe("Sacred Bharat edition archive route", () => {
  test("keeps unknown-edition handling compatible with Cache Components", () => {
    expect(source).not.toMatch(DYNAMIC_PARAMS_PATTERN);
    expect(source).toContain("getSacredBharatEdition(editionId)");
    expect(source).toContain("notFound()");
  });
});
