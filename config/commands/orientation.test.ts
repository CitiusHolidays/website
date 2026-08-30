import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatRevisionOrientation,
  OWNED_REFERENCE_RULES,
  validateOwnershipContracts,
} from "./orientation";

const ROOT = resolve(import.meta.dir, "../..");

function repositoryInputs() {
  const files = Object.fromEntries(
    OWNED_REFERENCE_RULES.map(({ path }) => [path, readFileSync(resolve(ROOT, path), "utf8")])
  );
  // SAFETY: the test controls the repository-owned package manifest boundary below.
  const packageJson = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  return { files, scripts: packageJson.scripts };
}

describe("Repository revision orientation", () => {
  test("Formats deterministic source orientation with an explicit proof boundary", () => {
    const state = {
      branch: "codex/example",
      revision: "0123456789abcdef0123456789abcdef01234567",
      trackedDirty: false,
    };
    const first = formatRevisionOrientation(state);

    expect(first).toBe(formatRevisionOrientation(state));
    expect(first).toContain(`Revision: ${state.revision}`);
    expect(first).toContain("Tracked working tree: clean");
    expect(first).toContain("not deployment or Production proof");
  });

  test("Fails closed when an owner document or task command drifts", () => {
    const inputs = repositoryInputs();
    expect(validateOwnershipContracts(inputs)).toEqual([]);

    const files = { ...inputs.files, "AGENTS.md": "bun run verify:local" };
    const scripts = { ...inputs.scripts, "spec:render-issue": "" };
    const errors = validateOwnershipContracts({ files, scripts });

    expect(errors).toContain("AGENTS.md is missing required owner reference: `bun run help`");
    expect(errors.some((error) => error.includes("spec:render-issue"))).toBe(true);
  });

  test("CLI reads source without changing the tracked working tree", () => {
    const before = spawnSync("git", ["status", "--porcelain"], {
      cwd: ROOT,
      encoding: "utf8",
    }).stdout;
    const result = spawnSync("bun", ["config/commands/orientation.ts", "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    const after = spawnSync("git", ["status", "--porcelain"], {
      cwd: ROOT,
      encoding: "utf8",
    }).stdout;

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ ownershipContracts: "passed" });
    expect(after).toBe(before);
  });
});
