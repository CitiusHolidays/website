import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOT = join(ROOT, "src");
const PACKAGE_JSON = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const SOURCE_FILE_PATTERN = /\.(?:js|jsx|ts|tsx)$/;

const FOUNDATION_DEPENDENCIES = [
  "@base-ui/react",
  "@dnd-kit/core",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",
  "@tanstack/react-table",
  "class-variance-authority",
  "cmdk",
  "sonner",
] as const;

const APPROVED_ENTRYPOINTS = {
  "@base-ui/react": "src/components/ui/foundation/base.ts",
  "@dnd-kit/core": "src/components/ui/foundation/dnd.ts",
  "@dnd-kit/sortable": "src/components/ui/foundation/dnd.ts",
  "@dnd-kit/utilities": "src/components/ui/foundation/dnd.ts",
  "@tanstack/react-table": "src/components/ui/foundation/table.ts",
  "class-variance-authority": "src/components/ui/foundation/variants.ts",
  cmdk: "src/components/ui/foundation/command.ts",
  sonner: "src/components/ui/foundation/toast.ts",
} satisfies Record<string, string>;

function directDependencyPattern(dependency: string): RegExp {
  const escapedDependency = dependency.replaceAll("/", "\\/");
  return new RegExp(
    `(?:\\b(?:import|export)[^;\\n]*?\\bfrom\\s*|\\bimport\\s*|\\b(?:import|require)\\s*\\()(["'])${escapedDependency}(?:\\/[^"']*)?\\1`,
    "g"
  );
}

function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      files.push(...collectSourceFiles(absolute));
    } else if (SOURCE_FILE_PATTERN.test(entry)) {
      files.push(absolute);
    }
  }
  return files;
}

describe("application UI foundation boundary", () => {
  test("pins every approved foundation dependency and exposes its code-owned entrypoint", () => {
    for (const dependency of FOUNDATION_DEPENDENCIES) {
      expect(PACKAGE_JSON.dependencies?.[dependency]).toBeString();
      expect(existsSync(join(ROOT, APPROVED_ENTRYPOINTS[dependency]))).toBe(true);
    }
  });

  test("keeps third-party UI libraries private to their approved entrypoints", () => {
    const sampleDependency = ["son", "ner"].join("");
    const importForms = [
      `import "${sampleDependency}";`,
      `import { toast } from "${sampleDependency}";`,
      `export { toast } from "${sampleDependency}";`,
      `export * from "${sampleDependency}";`,
      `import("${sampleDependency}")`,
      `require("${sampleDependency}")`,
    ];
    for (const source of importForms) {
      expect(directDependencyPattern(sampleDependency).test(source)).toBe(true);
    }

    const violations: string[] = [];
    for (const absolute of collectSourceFiles(SOURCE_ROOT)) {
      const file = relative(ROOT, absolute);
      const source = readFileSync(absolute, "utf8");
      for (const [dependency, entrypoint] of Object.entries(APPROVED_ENTRYPOINTS)) {
        const directImport = directDependencyPattern(dependency);
        if (file !== entrypoint && directImport.test(source)) {
          violations.push(`${file} imports ${dependency} directly; use ${entrypoint}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
