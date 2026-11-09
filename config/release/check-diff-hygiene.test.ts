import { afterEach, describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { CHILD_TEST_TIMEOUT_MS, runChild } from "../../test-helpers/runChild";
import {
  classifyIntegrationUnit,
  forbiddenReason,
  isReviewedLargeAsset,
  REVIEWED_CONVEX_GENERATED_PATHS,
} from "./check-diff-hygiene";

const SOURCE_SCRIPT = resolve(import.meta.dir, "check-diff-hygiene.ts");
const DELETED_ENTRYPOINT = "src/components/portal/PortalWorkspace.js";
const EXPECTED_SUCCESSOR = "src/components/portal/PortalWorkspace.tsx";
const tempRepositories: string[] = [];

async function run(
  command: string,
  args: string[],
  cwd: string,
  options: { allowFailure?: boolean; env?: Record<string, string> } = {}
) {
  const result = await runChild(command, args, {
    cwd,
    env: { ...process.env, ...options.env },
  });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result;
}

function git(root: string, ...args: string[]) {
  return run("git", args, root);
}

function write(root: string, path: string, contents = "export default null;\n") {
  const absolutePath = join(root, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
}

async function createRepository() {
  const root = mkdtempSync(join(tmpdir(), "citius-diff-hygiene-"));
  tempRepositories.push(root);
  mkdirSync(join(root, "config/release"), { recursive: true });
  copyFileSync(SOURCE_SCRIPT, join(root, "config/release/check-diff-hygiene.ts"));
  writeFileSync(
    join(root, "config/release/atomic-replacements.json"),
    `${JSON.stringify(
      {
        replacements: [
          {
            deletedPath: DELETED_ENTRYPOINT,
            successorPaths: [EXPECTED_SUCCESSOR],
          },
        ],
        schemaVersion: 1,
      },
      null,
      2
    )}\n`
  );
  write(root, DELETED_ENTRYPOINT);
  write(root, "src/components/portal/LegacyBanner.js");
  const init = await runChild("git", ["init", "--quiet", "--template="], { cwd: root });
  if (init.status !== 0) {
    throw new Error(`git init failed: ${init.stderr || init.stdout}`);
  }
  await git(root, "config", "user.email", "release-test@example.com");
  await git(root, "config", "user.name", "Release Test");
  await git(root, "add", ".");
  await git(root, "commit", "--quiet", "-m", "base");
  return { base: (await git(root, "rev-parse", "HEAD")).stdout.trim(), root };
}

async function commit(root: string, message: string) {
  await git(root, "add", "-A");
  await git(root, "commit", "--quiet", "-m", message);
}

function check(root: string, base: string) {
  return run(process.execPath, [join(root, "config/release/check-diff-hygiene.ts")], root, {
    allowFailure: true,
    env: { DIFF_BASE: base },
  });
}

afterEach(() => {
  for (const root of tempRepositories.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

async function probeGitAvailable() {
  const probeRoot = mkdtempSync(join(tmpdir(), "citius-git-probe-"));
  const init = await runChild("git", ["init", "--quiet", "--template="], { cwd: probeRoot });
  rmSync(probeRoot, { force: true, recursive: true });
  return init.status === 0;
}

const gitAvailable = await probeGitAvailable();
const describeHygiene = gitAvailable ? describe : describe.skip;

describeHygiene("atomic replacement diff hygiene", () => {
  test(
    "Rejects a candidate that deletes a protected entrypoint without its successor",
    async () => {
      const { base, root } = await createRepository();
      rmSync(join(root, DELETED_ENTRYPOINT));
      await commit(root, "delete entrypoint only");

      const result = await check(root, base);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(DELETED_ENTRYPOINT);
      expect(result.stderr).toContain(EXPECTED_SUCCESSOR);
    },
    CHILD_TEST_TIMEOUT_MS
  );

  test(
    "Accepts an atomic entrypoint replacement",
    async () => {
      const { base, root } = await createRepository();
      rmSync(join(root, DELETED_ENTRYPOINT));
      write(root, EXPECTED_SUCCESSOR);
      await commit(root, "replace entrypoint atomically");

      const result = await check(root, base);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Diff hygiene passed");
    },
    CHILD_TEST_TIMEOUT_MS
  );

  test(
    "Ignores an unrelated deletion",
    async () => {
      const { base, root } = await createRepository();
      rmSync(join(root, "src/components/portal/LegacyBanner.js"));
      await commit(root, "remove unrelated legacy file");

      expect((await check(root, base)).status).toBe(0);
    },
    CHILD_TEST_TIMEOUT_MS
  );

  test(
    "Rejects renaming a protected entrypoint to a non-successor",
    async () => {
      const { base, root } = await createRepository();
      await git(root, "mv", DELETED_ENTRYPOINT, "src/components/portal/PortalWorkspace.backup.js");
      await commit(root, "rename entrypoint somewhere else");

      const result = await check(root, base);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(DELETED_ENTRYPOINT);
      expect(result.stderr).toContain(EXPECTED_SUCCESSOR);
    },
    CHILD_TEST_TIMEOUT_MS
  );

  test(
    "Ignores a rename that is not a protected migration",
    async () => {
      const { base, root } = await createRepository();
      await git(
        root,
        "mv",
        "src/components/portal/LegacyBanner.js",
        "src/components/portal/RenamedBanner.js"
      );
      await commit(root, "rename unrelated file");

      expect((await check(root, base)).status).toBe(0);
    },
    CHILD_TEST_TIMEOUT_MS
  );
});

describe("Agent-tool integration-unit advisory", () => {
  const mixedPaths = [
    ".agents/skills/convex/SKILL.md",
    ".claude/hooks/react-doctor.mjs",
    "src/app/page.tsx",
    "convex/schema.ts",
  ];

  test("Flags the mixed toolchain and product shape seen in a broad integration range", () => {
    expect(classifyIntegrationUnit(mixedPaths)).toMatchObject({
      advisory: true,
      couplingAcknowledged: false,
      mixed: true,
    });
  });

  test("Accepts an explicit coupling note without hiding the mixed range", () => {
    expect(
      classifyIntegrationUnit(mixedPaths, "hook is required by the runtime check")
    ).toMatchObject({
      advisory: false,
      couplingAcknowledged: true,
      mixed: true,
    });
  });

  test("Does not flag an isolated product range", () => {
    expect(classifyIntegrationUnit(["src/app/page.tsx", "convex/schema.ts"])).toMatchObject({
      advisory: false,
      couplingAcknowledged: false,
      mixed: false,
    });
  });
});

describe("Reviewed Convex generated surface", () => {
  test("Allows only the five clean-clone API modules tracked by the repository", () => {
    expect([...REVIEWED_CONVEX_GENERATED_PATHS].sort()).toEqual([
      "convex/_generated/api.d.ts",
      "convex/_generated/api.js",
      "convex/_generated/dataModel.d.ts",
      "convex/_generated/server.d.ts",
      "convex/_generated/server.js",
    ]);
    for (const path of REVIEWED_CONVEX_GENERATED_PATHS) {
      expect(forbiddenReason(path)).toBeNull();
    }
    expect(forbiddenReason("convex/_generated/components.js")).toContain("generated output");
    expect(forbiddenReason("convex/betterAuth/_generated/api.js")).toContain("generated output");
  });
});

test("Large booth binaries require their exact reviewed path, size and digest", () => {
  for (const path of [
    "public/photo-booth/vendor/mediapipe-1.0.1/wasm/vision_wasm_module_internal.wasm",
    "public/photo-booth/vendor/selfie-multiclass-256-v1.tflite",
  ]) {
    const contents = readFileSync(resolve(import.meta.dir, "../..", path));
    expect(isReviewedLargeAsset(path, contents)).toBe(true);
    expect(isReviewedLargeAsset(`${path}.changed`, contents)).toBe(false);
    expect(isReviewedLargeAsset(path, contents.subarray(1))).toBe(false);
    const changed = new Uint8Array(contents);
    changed[0] = (changed[0] + 1) % 256;
    expect(isReviewedLargeAsset(path, changed)).toBe(false);
  }
});
