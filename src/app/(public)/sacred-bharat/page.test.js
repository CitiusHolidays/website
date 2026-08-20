import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dir, "page.js"), "utf8");
const INSTANT_RENDERING_DISABLED_PATTERN = /^export const instant = false;/m;

describe("Sacred Bharat edition route rendering", () => {
  test("opts its runtime operational-control read out of instant prerendering", () => {
    expect(source).toMatch(INSTANT_RENDERING_DISABLED_PATTERN);
  });
});
