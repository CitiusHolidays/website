import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dir, "page.js"), "utf8");

describe("Sacred Bharat edition route rendering", () => {
  test("opts its runtime operational-control read out of instant prerendering", () => {
    expect(source).toMatch(/^export const instant = false;/m);
  });
});
