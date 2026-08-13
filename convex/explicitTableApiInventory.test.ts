import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  discoverLegacyDocumentCalls,
  legacyDocumentCallsInSource,
  summarizeLegacyDocumentCalls,
} from "../config/release/convex-explicit-table-inventory";

const CONVEX_ROOT = new URL(".", import.meta.url).pathname;
const BASELINE_PATH = join(CONVEX_ROOT, "../config/release/convex-explicit-table-gaps.txt");

function baseline() {
  return readFileSync(BASELINE_PATH, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

describe("Convex explicit-table database API inventory", () => {
  test("distinguishes ID-only calls from explicit-table calls", () => {
    const source = `
      await ctx.db.get(id);
      await ctx.db.get("queries", id);
      await ctx.db.patch(id, patch);
      await ctx.db.patch("queries", id, patch);
      await ctx.db.replace(id, value);
      await ctx.db.replace("queries", id, value);
      await ctx.db.delete(id);
      await ctx.db.delete("queries", id);
    `;
    expect(legacyDocumentCallsInSource(source, "fixture.ts")).toEqual([
      { file: "fixture.ts", method: "get" },
      { file: "fixture.ts", method: "patch" },
      { file: "fixture.ts", method: "replace" },
      { file: "fixture.ts", method: "delete" },
    ]);
  });

  test("fails on every new ID-only call and records each owned file-method exception", () => {
    const calls = discoverLegacyDocumentCalls(CONVEX_ROOT);
    expect(summarizeLegacyDocumentCalls(calls)).toEqual(baseline());
    expect(calls).toHaveLength(523);
  });
});
