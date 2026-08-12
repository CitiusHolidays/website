import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const hook = resolve(root, ".claude/hooks/react-doctor.mjs");
const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function makeProject() {
  const directory = mkdtempSync(resolve(tmpdir(), "citius-react-doctor-hook-"));
  tempDirectories.push(directory);
  return directory;
}

function runHook(projectRoot: string) {
  return spawnSync(process.execPath, [hook], {
    encoding: "utf8",
    env: { CLAUDE_PROJECT_DIR: projectRoot, PATH: process.env.PATH },
    input: JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Edit" }),
  });
}

describe("React Doctor hook", () => {
  test("uses only the reviewed local package without a shell or mutable fallback", () => {
    const source = readFileSync(hook, "utf8");
    expect(source).toContain('join(projectRoot, "node_modules", "react-doctor"');
    expect(source).toContain("shell: false");
    expect(source).not.toContain("shell: true");
    expect(source).not.toContain("@latest");
    expect(source).not.toContain("pnpm dlx");
    expect(source).not.toContain("npx --yes");
  });

  test("reports a missing pinned install instead of silently skipping or downloading", () => {
    const result = runHook(makeProject());
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("React Doctor is not installed from the reviewed lockfile");
    expect(result.stdout).toContain("bun install --frozen-lockfile");
  });

  test("runs the package entry with Node and returns changed-scope diagnostics", () => {
    const project = makeProject();
    const binDirectory = resolve(project, "node_modules/react-doctor/bin");
    const entry = resolve(binDirectory, "react-doctor.js");
    mkdirSync(binDirectory, { recursive: true });
    writeFileSync(
      entry,
      '#!/usr/bin/env node\nprocess.stderr.write("fake-doctor " + process.argv.slice(2).join(" ")); process.exit(1);\n'
    );
    chmodSync(entry, 0o755);

    const result = runHook(project);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "fake-doctor --verbose --scope changed --blocking warning --no-score"
    );
  });
});
