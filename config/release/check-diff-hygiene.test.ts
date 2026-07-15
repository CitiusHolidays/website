import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const SOURCE_SCRIPT = resolve(import.meta.dir, "check-diff-hygiene.ts");
const DELETED_ENTRYPOINT = "src/components/portal/PortalWorkspace.js";
const EXPECTED_SUCCESSOR = "src/components/portal/PortalWorkspace.tsx";
const tempRepositories: string[] = [];

function run(
  command: string,
  args: string[],
  cwd: string,
  options: { allowFailure?: boolean; env?: Record<string, string> } = {}
) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
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

function createRepository() {
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
  git(root, "init", "--quiet");
  git(root, "config", "user.email", "release-test@example.com");
  git(root, "config", "user.name", "Release Test");
  git(root, "add", ".");
  git(root, "commit", "--quiet", "-m", "base");
  return { base: git(root, "rev-parse", "HEAD").stdout.trim(), root };
}

function commit(root: string, message: string) {
  git(root, "add", "-A");
  git(root, "commit", "--quiet", "-m", message);
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

describe("atomic replacement diff hygiene", () => {
  test("rejects a candidate that deletes a protected entrypoint without its successor", () => {
    const { base, root } = createRepository();
    rmSync(join(root, DELETED_ENTRYPOINT));
    commit(root, "delete entrypoint only");

    const result = check(root, base);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(DELETED_ENTRYPOINT);
    expect(result.stderr).toContain(EXPECTED_SUCCESSOR);
  });

  test("accepts an atomic entrypoint replacement", () => {
    const { base, root } = createRepository();
    rmSync(join(root, DELETED_ENTRYPOINT));
    write(root, EXPECTED_SUCCESSOR);
    commit(root, "replace entrypoint atomically");

    const result = check(root, base);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Diff hygiene passed");
  });

  test("ignores an unrelated deletion", () => {
    const { base, root } = createRepository();
    rmSync(join(root, "src/components/portal/LegacyBanner.js"));
    commit(root, "remove unrelated legacy file");

    expect(check(root, base).status).toBe(0);
  });

  test("rejects renaming a protected entrypoint to a non-successor", () => {
    const { base, root } = createRepository();
    git(root, "mv", DELETED_ENTRYPOINT, "src/components/portal/PortalWorkspace.backup.js");
    commit(root, "rename entrypoint somewhere else");

    const result = check(root, base);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(DELETED_ENTRYPOINT);
    expect(result.stderr).toContain(EXPECTED_SUCCESSOR);
  });

  test("ignores a rename that is not a protected migration", () => {
    const { base, root } = createRepository();
    git(
      root,
      "mv",
      "src/components/portal/LegacyBanner.js",
      "src/components/portal/RenamedBanner.js"
    );
    commit(root, "rename unrelated file");

    expect(check(root, base).status).toBe(0);
  });
});
