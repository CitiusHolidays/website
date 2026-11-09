import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The root layout appends " | Citius Holidays" to every child title (src/app/layout.js), so a
// page title that already names the brand renders it twice in the browser tab.
const ROUTE_FILE_PATTERN = /^(?:page|layout)\.(?:js|jsx|ts|tsx)$/;
const BRAND_SUFFIXED_TITLE_PATTERN =
  /\btitle:\s*["'`][^"'`]*\|\s*Citius(?: Holidays(?: Management)?)?["'`]/g;
const EXTRA_TITLE_FILES = ["src/lib/auth-sign-in-targets.js"];

function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return routeFiles(path);
    }
    return ROUTE_FILE_PATTERN.test(entry) ? [path] : [];
  });
}

describe("Metadata title suffix contract", () => {
  test("No templated route title repeats the Citius Holidays brand suffix", () => {
    const offenders = [...routeFiles("src/app"), ...EXTRA_TITLE_FILES].flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(BRAND_SUFFIXED_TITLE_PATTERN)].map(
        (match) => `${file}: ${match[0]}`
      )
    );

    expect(offenders).toEqual([]);
  });

  test("The Staff Workspace layout title stands alone instead of taking the public suffix", () => {
    const portalLayout = readFileSync("src/app/portal/layout.js", "utf8");

    expect(portalLayout).toContain('title: { absolute: "Citius Connect" }');
  });
});
