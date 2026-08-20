import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");

function readPackageJson() {
  // SAFETY: This test controls the asserted value at the framework boundary below.
  return JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    engines?: Record<string, string>;
    packageManager?: string;
    scripts: Record<string, string>;
  };
}

function readBlogPackageJson() {
  // SAFETY: This test controls the asserted value at the framework boundary below.
  return JSON.parse(readFileSync(resolve(root, "citius-blog/package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
}

describe("Package and test discovery contract", () => {
  test("Pins stable Next and keeps patched multi-major dependency floors explicit", () => {
    const { dependencies } = readPackageJson();

    expect(dependencies.next).toBe("16.3.0");
    expect(dependencies.next).not.toContain("preview");
    expect(dependencies["next-sanity"]).toBeUndefined();
    expect(dependencies["@sanity/client"]).toBeDefined();
    expect(dependencies["@portabletext/react"]).toBeDefined();
    expect(dependencies.groq).toBeUndefined();
    expect(dependencies["brace-expansion"]).toBe("1.1.18");
    expect(dependencies.undici).toBe("7.29.0");
    expect(dependencies.dompurify).toBe("3.4.13");
  });

  test("Keeps the standalone Sanity Studio on its reviewed runtime contract", () => {
    const { dependencies, scripts } = readBlogPackageJson();

    expect(dependencies.sanity).toBe("6.9.1");
    expect(dependencies["@sanity/sdk"]).toBe("^2.19.0");
    expect(dependencies["@sanity/vision"]).toBe("6.9.1");
    expect(dependencies.react).toBe("19.2.8");
    expect(dependencies["styled-components"]).toBe("6.5.1");
    expect(scripts.build).toBe("sanity build");
    expect(scripts.build).not.toContain("bun --bun");
  });

  test("Pins the local toolchain and keeps Next Node-hosted behind one Convex supervisor", () => {
    const packageJson = readPackageJson();

    expect(packageJson.packageManager).toBe("bun@1.3.14");
    expect(packageJson.engines).toEqual({ bun: "1.3.14", node: ">=22.12 <27" });
    expect(packageJson.scripts["dev:doctor"]).toBe("bun config/dev/doctor.ts");
    expect(packageJson.scripts.dev).toBe("next dev --turbopack");
    expect(packageJson.scripts["dev:webpack"]).toBe("next dev --webpack");
    expect(packageJson.scripts.dev).not.toContain("bun --bun");
    expect(packageJson.scripts["dev:all"]).toBe("bunx convex dev --start 'bun run dev'");
    expect(packageJson.scripts["convex:dev"]).toBe("bunx convex dev");
    expect(packageJson.scripts.test).toBe("bun config/test/run-target-neutral-tests.ts");
    expect(packageJson.scripts.check).toContain("bun run test:convex");
    expect(
      readFileSync(resolve(root, ".github/workflows/hosted-quality.yml"), "utf8")
    ).not.toContain("bun-version-file");
    expect(packageJson.scripts.doctor).toBe("react-doctor");
    expect(packageJson.devDependencies["react-doctor"]).toBe("0.9.11");
    expect(packageJson.dependencies.effect).toBe("4.0.0-rc.109");
    expect(packageJson.devDependencies.oxlint).toBe("1.78.0");
    expect(packageJson.devDependencies["@oxlint/plugins"]).toBe("1.78.0");
    expect(packageJson.devDependencies["@typescript/native"]).toBe("npm:typescript@7.0.2");
    expect(packageJson.devDependencies.typescript).toBe("6.0.3");
    expect(packageJson.scripts.lint).toBe("ultracite check && bun run lint:anti-slop");
    expect(packageJson.scripts["lint:all"]).toBe(
      "ultracite check --error-on-warnings && bun run lint:anti-slop && bun run lint:ratchet && bun run --cwd citius-blog lint"
    );
    expect(packageJson.scripts["lint:anti-slop"]).toBe(
      "bun node_modules/oxlint/bin/oxlint --config oxlint.config.ts ."
    );
    expect(packageJson.devDependencies.husky).toBe("9.1.7");
    expect(packageJson.devDependencies["lint-staged"]).toBe("17.3.0");
    expect(packageJson.devDependencies.knip).toBe("6.32.2");
    expect(packageJson.devDependencies.jsdom).toBe("30.0.1");
    expect(packageJson.dependencies["isomorphic-dompurify"]).toBeUndefined();
    expect(existsSync(resolve(root, "src/lib/email/send.js"))).toBe(false);
    expect(readFileSync(resolve(root, "doctor.config.json"), "utf8")).not.toContain(
      "src/lib/email/send.js"
    );
    expect(packageJson.scripts.deadcode).toBe("knip --config knip.jsonc --reporter compact");
    expect(packageJson.scripts["deadcode:ratchet"]).toBe("bun config/release/deadcode-ratchet.ts");
    expect(packageJson.scripts.prepare).toBe("husky");
    expect(packageJson.scripts["precommit:check"]).toBe(
      "git diff --cached --check && bunx --no-install lint-staged"
    );
    expect(packageJson.scripts["quality:target-neutral"]).toBe(
      "bun config/release/run-target-neutral-quality.ts"
    );
  });

  test("Pins local React inspection and excludes it from official performance commands", () => {
    const packageJson = readPackageJson();
    const instrumentationPath = resolve(root, "src/lib/dev/react-inspection-client.ts");

    expect(packageJson.devDependencies["react-grab"]).toBe("0.1.50");
    expect(packageJson.devDependencies["react-scan"]).toBe("0.5.7");
    expect(packageJson.scripts["dev:inspect"]).toBe(
      "CITIUS_REACT_INSPECTION=1 next dev --turbopack"
    );
    expect(packageJson.scripts["performance:check"]).toBe(
      "bun config/release/check-performance-budgets.ts"
    );
    expect(packageJson.scripts["performance:public:collect"]).toBe(
      "bun scripts/public-runtime-performance.ts"
    );
    expect(packageJson.scripts["performance:staff:collect"]).toBe(
      "bun config/e2e/run-authenticated-performance.ts"
    );

    expect(existsSync(instrumentationPath)).toBe(true);
    const instrumentation = readFileSync(instrumentationPath, "utf8");
    expect(instrumentation).toContain('from "react-grab/core"');
    expect(instrumentation).toContain('from "react-scan"');
    expect(instrumentation).toContain("telemetry: false");
    expect(instrumentation).toContain("dangerouslyForceRunInProduction: false");
    expect(instrumentation).not.toContain("http://");
    expect(instrumentation).not.toContain("https://");
  });
});
