import { describe, expect, test } from "bun:test";
import { file as bunFile, Glob } from "bun";
import { cn } from "./utils";

const SOURCE_GLOB = new Glob("src/**/*.{js,jsx,ts,tsx}");
const RETIRED_CN_IMPORT = /(?:@\/utils\/cn|(?:\.\.?\/)+utils\/cn)/;

describe("canonical conditional class composition", () => {
  test("keeps caller-last Tailwind overrides deterministic", () => {
    expect(cn("bg-white p-4", null, ["p-2", { "bg-black": true }])).toBe("p-2 bg-black");
  });

  test("rejects the retired truthy-join helper import", async () => {
    const sourcePaths = [...SOURCE_GLOB.scanSync({ cwd: process.cwd(), onlyFiles: true })].filter(
      (path) => path !== "src/lib/utils.test.js"
    );
    const sources = await Promise.all(sourcePaths.map((path) => bunFile(path).text()));
    const violations = sourcePaths.filter((_, index) => RETIRED_CN_IMPORT.test(sources[index]));
    expect(violations.sort()).toEqual([]);
  });
});
