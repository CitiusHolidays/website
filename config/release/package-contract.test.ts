import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");

describe("package and test discovery contract", () => {
  test("every local file referenced by a package script exists", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const missing: string[] = [];

    for (const [name, command] of Object.entries(packageJson.scripts)) {
      for (const [, relativePath] of command.matchAll(
        /(?:^|\s)((?:bin|config|scripts)\/[^\s'"]+)/g
      )) {
        if (relativePath && !existsSync(resolve(root, relativePath))) {
          missing.push(`${name}: ${relativePath}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  test("the workflow presentation policy suite has one canonical filename", () => {
    expect(existsSync(resolve(root, "src/lib/portal/workflowPresentationPolicy.test.ts"))).toBe(
      true
    );
    expect(existsSync(resolve(root, "src/lib/portal/workflowPresentation.test.ts"))).toBe(false);
  });
});
