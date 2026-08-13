import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import {
  EFFECT_ADOPTION_INVENTORY,
  EFFECT_ADOPTION_PRESSURES,
  evaluateEffectAdoption,
} from "./effectAdoption";

const root = resolve(import.meta.dir, "../..");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const effectImportPattern =
  /^\s*import\s+(?:type\s+)?[^;\n]*?\sfrom\s+["']effect(?:\/[^"']*)?["']/m;

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_generated" || entry.name === "node_modules") {
        return [];
      }
      return productionSourceFiles(path);
    }
    if (!(sourceExtensions.has(extname(entry.name)) && !entry.name.includes(".test."))) {
      return [];
    }
    return [path];
  });
}

function scanEffectImports(files: readonly { path: string; source: string }[]) {
  return files.filter(({ source }) => effectImportPattern.test(source)).map(({ path }) => path);
}

describe("evaluateEffectAdoption", () => {
  test("approves Effect only when at least two distinct orchestration pressures apply", () => {
    const result = evaluateEffectAdoption([
      "external-io",
      "typed-recoverable-errors",
      "external-io",
    ]);

    expect(result.appropriate).toBe(true);
    expect(result.matchedPressures).toEqual(["external-io", "typed-recoverable-errors"]);
    expect(result.missingPressureCount).toBe(0);
  });

  test("rejects Effect for simple async code or simple React and Convex state", () => {
    const simpleAsync = evaluateEffectAdoption(["external-io"]);
    const simpleState = evaluateEffectAdoption([]);

    expect(simpleAsync.appropriate).toBe(false);
    expect(simpleAsync.missingPressureCount).toBe(1);
    expect(simpleState.appropriate).toBe(false);
    expect(simpleState.missingPressureCount).toBe(2);
  });

  test("keeps the approved pressure vocabulary stable for agent prompts", () => {
    expect(EFFECT_ADOPTION_PRESSURES).toEqual([
      "external-io",
      "retry-or-throttle",
      "concurrency-control",
      "typed-recoverable-errors",
      "rollback-or-cleanup",
      "test-time-dependency-substitution",
    ]);
  });

  test("keeps Effect only where the current implementation materially simplifies orchestration", () => {
    const seams = {
      "notification email delivery": [
        "external-io",
        "retry-or-throttle",
        "typed-recoverable-errors",
        "test-time-dependency-substitution",
      ],
    } as const;

    for (const pressures of Object.values(seams)) {
      expect(evaluateEffectAdoption(pressures).appropriate).toBe(true);
    }
  });

  test("accounts exactly once for every production Effect import under the v3 convention", () => {
    const productionEffectImports = scanEffectImports(
      ["config", "convex", "scripts", "src"].flatMap((directory) =>
        productionSourceFiles(resolve(root, directory)).map((path) => ({
          path: relative(root, path),
          source: readFileSync(path, "utf8"),
        }))
      )
    ).sort();

    expect(EFFECT_ADOPTION_INVENTORY.map((entry) => entry.path).sort()).toEqual(
      productionEffectImports
    );
    expect(new Set(EFFECT_ADOPTION_INVENTORY.map((entry) => entry.path)).size).toBe(
      EFFECT_ADOPTION_INVENTORY.length
    );
    for (const entry of EFFECT_ADOPTION_INVENTORY) {
      expect(entry.effectMajor).toBe(3);
      expect(entry.materialSimplification.length).toBeGreaterThan(24);
      expect(evaluateEffectAdoption(entry.matchedPressures).appropriate).toBe(true);
    }
  });

  test("detects an unlisted production import without treating comments as adoption", () => {
    expect(
      scanEffectImports([
        { path: "src/comment.ts", source: '// import { Effect } from "effect"' },
        { path: "src/new-seam.ts", source: 'import { Effect } from "effect";' },
      ])
    ).toEqual(["src/new-seam.ts"]);
  });
  test("keeps the three payment seams on plain TypeScript boundaries", () => {
    for (const path of [
      "src/app/api/create-order/route.ts",
      "src/lib/paymentVerification.ts",
      "src/lib/razorpayWebhook.ts",
    ]) {
      const source = readFileSync(resolve(root, path), "utf8");
      expect(source, path).not.toMatch(effectImportPattern);
      expect(source, path).not.toContain("buildExternalIoEffect");
    }
  });
});
