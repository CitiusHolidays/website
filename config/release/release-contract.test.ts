import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

interface EnvironmentManifest {
  browser: string[];
  ciDeploy: string[];
  convexRuntime: string[];
  nextServer: string[];
  oneTimeOperations: string[];
}

interface AtomicReplacementManifest {
  replacements: Array<{ deletedPath: string; successorPaths: string[] }>;
  schemaVersion: number;
}

interface ReleaseContract {
  convexAwareBuildCommand: string;
  generatedSurfaces: string[];
  requiredCiCommands: string[];
  sanityStudioCiCommands: string[];
}

const ROOT = resolve(import.meta.dir, "../..");
const manifest = JSON.parse(
  readFileSync(join(ROOT, "config/environment.manifest.json"), "utf8")
) as EnvironmentManifest;
const releaseContract = JSON.parse(
  readFileSync(join(ROOT, "config/release/release-contract.json"), "utf8")
) as ReleaseContract;
const atomicReplacements = JSON.parse(
  readFileSync(join(ROOT, "config/release/atomic-replacements.json"), "utf8")
) as AtomicReplacementManifest;
const SOURCE_EXTENSIONS = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const WORKFLOW_ONLY_KEYS = new Set(["CONVEX_DEPLOY_KEY", "CONVEX_DEPLOYMENT"]);
const ENV_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const ENV_ENTRY_PATTERN = /^([A-Z][A-Z0-9_]*)=(.*)$/;
const ENV_REFERENCE_PATTERN = /\b(?:process\.env|env)\.([A-Z][A-Z0-9_]*)\b/g;
const RAW_BUN_TEST_PATTERN = /^\s*run:\s*bun test\s*$/m;
const GLOBAL_CONVEX_CREDENTIAL_PATTERN = /^env:\s*\n\s+CONVEX_DEPLOY_KEY:/m;
const IMMUTABLE_ACTION_PATTERN = /@[0-9a-f]{40}$/;
const ACTION_REFERENCE_PATTERN = /^\s*(?:-\s*)?uses:\s*([^\s#]+)\s*$/gm;

function extension(path: string) {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot);
}

function sourceFiles(path: string): string[] {
  if (statSync(path).isFile()) {
    return SOURCE_EXTENSIONS.has(extension(path)) ? [path] : [];
  }
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "_generated" ? [] : sourceFiles(child);
    }
    return entry.name.includes(".test.") ? [] : sourceFiles(child);
  });
}

function sourceEnvironmentKeys() {
  const keys = new Set<string>();
  const paths = [join(ROOT, "src"), join(ROOT, "convex"), join(ROOT, "next.config.mjs")];
  for (const path of paths.flatMap(sourceFiles)) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(ENV_REFERENCE_PATTERN)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function manifestKeys() {
  return new Set(Object.values(manifest).flat());
}

describe("environment contract", () => {
  test("contains sorted key names only and covers source plus workflow usage exactly", () => {
    for (const [scope, keys] of Object.entries(manifest)) {
      expect(keys).toEqual([...keys].sort());
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) {
        expect(key).toMatch(ENV_KEY_PATTERN);
      }
      expect(scope.length).toBeGreaterThan(0);
    }

    expect(manifestKeys()).toEqual(new Set([...sourceEnvironmentKeys(), ...WORKFLOW_ONLY_KEYS]));
  });

  test("keeps the checked-in example key-only and in parity with the manifest", () => {
    const example = readFileSync(join(ROOT, ".env.example"), "utf8");
    const entries = example
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.match(ENV_ENTRY_PATTERN));

    expect(entries.every(Boolean)).toBe(true);
    const keys = entries.map((entry) => entry?.[1] ?? "");
    expect(new Set(keys)).toEqual(manifestKeys());
    expect(entries.every((entry) => entry?.[2] === "")).toBe(true);
  });
});

describe("release command contract", () => {
  test("protects the active portal entrypoint replacements", () => {
    expect(atomicReplacements).toEqual({
      replacements: [
        {
          deletedPath: "src/components/portal/PortalWorkspace.js",
          successorPaths: ["src/components/portal/PortalWorkspace.tsx"],
        },
        {
          deletedPath: "src/components/portal/SelectableDataTable.js",
          successorPaths: ["src/components/portal/SelectableDataTable.tsx"],
        },
      ],
      schemaVersion: 1,
    });
  });

  test("protects the Convex-aware Vercel command", () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as {
      buildCommand?: string;
    };
    expect(vercel.buildCommand).toBe(releaseContract.convexAwareBuildCommand);
  });

  test("keeps production Next builds and functions on the Node runtime", () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as {
      bunVersion?: string;
    };
    const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(vercel.bunVersion).toBeUndefined();
    expect(packageJson.scripts?.build).toBe("bunx convex codegen --typecheck enable && next build");
    expect(packageJson.scripts?.start).toBe("next start");
  });

  test("keeps every required gate in the read-only quality workflow", () => {
    const workflow = readFileSync(join(ROOT, ".github/workflows/required-quality.yml"), "utf8");
    for (const command of releaseContract.requiredCiCommands) {
      expect(workflow).toContain(command);
    }
    expect(workflow).not.toContain("bunx convex deploy");
    expect(workflow).toContain("permissions:\n  contents: read");
  });

  test("runs fresh Convex generation before the canonical unit-test command", () => {
    const workflow = readFileSync(join(ROOT, ".github/workflows/required-quality.yml"), "utf8");
    const codegenStep = workflow.indexOf("bunx convex codegen --typecheck enable");
    const testStep = workflow.indexOf("run: bun run test");

    expect(codegenStep).toBeGreaterThanOrEqual(0);
    expect(testStep).toBeGreaterThan(codegenStep);
    expect(workflow).not.toMatch(RAW_BUN_TEST_PATTERN);
    expect(workflow).toContain("bun-version: 1.3.14");
  });

  test("installs, builds, and audits the standalone Sanity Studio", () => {
    const workflow = readFileSync(join(ROOT, ".github/workflows/required-quality.yml"), "utf8");

    for (const command of releaseContract.sanityStudioCiCommands) {
      expect(workflow).toContain(`working-directory: citius-blog\n        run: ${command}`);
    }
    expect(workflow.match(/working-directory: citius-blog/g)).toHaveLength(
      releaseContract.sanityStudioCiCommands.length
    );
    expect(workflow).toContain("node-version: 22.12.0");
  });

  test("runs the same core gates on trusted pull requests and main pushes", () => {
    const workflow = readFileSync(join(ROOT, ".github/workflows/required-quality.yml"), "utf8");

    expect(workflow).toContain("  pull_request:\n");
    expect(workflow).toContain("  push:\n    branches: [main]");
    expect(workflow).toContain("bun run env:preflight -- --target preview");
    expect(workflow).toContain(
      "github.event.pull_request.head.repo.full_name != github.repository"
    );
    expect(workflow).not.toContain("github.ref == 'refs/heads/main'");
    expect(workflow).not.toMatch(GLOBAL_CONVEX_CREDENTIAL_PATTERN);
  });

  test("pins every third-party workflow action to an immutable commit", () => {
    const workflow = readFileSync(join(ROOT, ".github/workflows/required-quality.yml"), "utf8");
    const actionRefs = [...workflow.matchAll(ACTION_REFERENCE_PATTERN)].map((match) => match[1]);

    expect(actionRefs.length).toBeGreaterThan(0);
    for (const actionRef of actionRefs) {
      expect(actionRef).toMatch(IMMUTABLE_ACTION_PATTERN);
    }
    expect(workflow).not.toContain("pull_request_target");
  });

  test("keeps generated Convex output outside lint scope", () => {
    const biome = JSON.parse(readFileSync(join(ROOT, "biome.json"), "utf8")) as {
      files?: { includes?: string[] };
    };
    for (const surface of releaseContract.generatedSurfaces) {
      expect(biome.files?.includes).toContain(`!${surface}`);
    }
  });

  test("exposes stable local gate entry points", () => {
    const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.["lint:ratchet"]).toBe("bun config/release/lint-ratchet.ts");
    expect(packageJson.scripts?.check).toContain("bun run lint");
    expect(packageJson.scripts?.check).toContain("bun run lint:ratchet");
    expect(packageJson.scripts?.check).toContain("bun run test");
    expect(packageJson.scripts?.test).toContain("--isolate");
    expect(packageJson.scripts?.test).toContain("--path-ignore-patterns='e2e/specs/**'");
    expect(packageJson.scripts?.["diff:check"]).toBe("bun config/release/check-diff-hygiene.ts");
    expect(packageJson.scripts?.["policy:check"]).toBe("bun config/release/check-ci-policy.ts");
    expect(packageJson.scripts?.["performance:check"]).toBe(
      "bun config/release/check-performance-budgets.ts"
    );
    expect(packageJson.scripts?.["automation:check"]).toBe(
      "bun config/release/agent-automation-policy.ts"
    );
  });

  test("documents the explicit-consent boundary for destructive automation", () => {
    const policy = readFileSync(join(ROOT, "docs/AGENT_AUTOMATION_CONSENT.md"), "utf8");
    expect(policy).toContain("AUTOMATION_APPROVAL_RECORD");
    expect(policy).toContain("never invokes the command");
    expect(policy).toContain("exact command");
  });

  test("does not hide repository source and documentation behind broad ignore rules", () => {
    const ignoredLines = readFileSync(join(ROOT, ".gitignore"), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    expect(ignoredLines).not.toContain("docs/*");
    expect(ignoredLines).not.toContain("scripts");
    expect(ignoredLines).not.toContain("bin/*");
    expect(ignoredLines).not.toContain(".agents/*");
    expect(ignoredLines).not.toContain(".claude/*");
    expect(ignoredLines).toContain(".scratch/");
    expect(ignoredLines).toContain(".claude/hooks/");
  });
});
