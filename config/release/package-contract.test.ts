import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");

function readPackageJson() {
  return JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    engines?: Record<string, string>;
    packageManager?: string;
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
    expect(dependencies.dompurify).toBe("3.4.13");
  });

  test("keeps the standalone Sanity Studio on its reviewed runtime contract", () => {
    const { dependencies, scripts } = readBlogPackageJson();

    expect(dependencies.sanity).toBe("6.9.1");
    expect(dependencies["@sanity/sdk"]).toBe("^2.19.0");
    expect(dependencies["@sanity/vision"]).toBe("6.9.1");
    expect(dependencies.react).toBe("19.2.8");
    expect(dependencies["styled-components"]).toBe("6.5.1");
    expect(scripts.build).toBe("sanity build");
    expect(scripts.build).not.toContain("bun --bun");
  });

  test("pins the local toolchain and keeps Next Node-hosted behind one Convex supervisor", () => {
    const packageJson = readPackageJson();

    expect(packageJson.packageManager).toBe("bun@1.3.14");
    expect(packageJson.engines).toEqual({ bun: ">=1.3.14 <2", node: ">=22.12 <27" });
    expect(packageJson.scripts["dev:doctor"]).toBe("bun config/dev/doctor.ts");
    expect(packageJson.scripts.dev).toBe("next dev --turbopack");
    expect(packageJson.scripts["dev:webpack"]).toBe("next dev --webpack");
    expect(packageJson.scripts.dev).not.toContain("bun --bun");
    expect(packageJson.scripts["dev:all"]).toBe("bunx convex dev --start 'bun run dev'");
    expect(packageJson.scripts["convex:dev"]).toBe("bunx convex dev");
    expect(packageJson.scripts.test).toBe("bun config/test/run-target-neutral-tests.ts");
    expect(packageJson.scripts.check).toContain("bun run test:convex");
    expect(readFileSync(resolve(root, ".bun-version"), "utf8").trim()).toBe("1.3.14");
    expect(readFileSync(resolve(root, ".node-version"), "utf8").trim()).toBe("22.12.0");
    expect(packageJson.scripts.doctor).toBe("react-doctor");
    expect(packageJson.devDependencies["react-doctor"]).toBe("0.9.11");
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
  });
});
