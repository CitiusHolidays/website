import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");

function readPackageJson() {
  return JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
}

function readBlogPackageJson() {
  return JSON.parse(readFileSync(resolve(root, "citius-blog/package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
}

describe("package and test discovery contract", () => {
  test("every local file referenced by a package script exists", () => {
    const packageJson = readPackageJson();
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

  test("pins stable Next and keeps patched multi-major dependency floors explicit", () => {
    const { dependencies } = readPackageJson();

    expect(dependencies.next).toBe("16.3.0");
    expect(dependencies.next).not.toContain("preview");
    expect(dependencies["next-sanity"]).toBeUndefined();
    expect(dependencies["@sanity/client"]).toBeDefined();
    expect(dependencies["@portabletext/react"]).toBeDefined();
    expect(dependencies.groq).toBeUndefined();
    expect(dependencies["brace-expansion"]).toBe("1.1.18");
    expect(dependencies.undici).toBe("7.29.0");
  });

  test("keeps the standalone Sanity Studio on its reviewed runtime contract", () => {
    const { dependencies, scripts } = readBlogPackageJson();

    expect(dependencies.sanity).toBe("6.9.0");
    expect(dependencies["@sanity/vision"]).toBe("6.9.0");
    expect(dependencies.react).toBe("19.2.8");
    expect(scripts.build).toBe("sanity build");
    expect(scripts.build).not.toContain("bun --bun");
  });
});
