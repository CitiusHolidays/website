import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const workflow = readFileSync(resolve(root, ".github/workflows/hosted-quality.yml"), "utf8");
const sharedQuality = readFileSync(
  resolve(root, "config/release/run-target-neutral-quality.ts"),
  "utf8"
);
const ACTION_REFERENCE_PATTERN = /uses:\s+[^@\s]+@([^\s]+)/g;
const IMMUTABLE_ACTION_REFERENCE_PATTERN = /^[a-f0-9]{40}$/;
const WORKFLOW_ENVIRONMENT_PATTERN = /^\s+environment:/m;
const TEMPLATE_DOLLAR = String.fromCodePoint(36);
const BUN_VERSION_PATTERN = /bun-version:\s*(\S+)/g;
const TRIGGER_BLOCK_PATTERN = /^on:\n((?:[ #].*\n|\n)*)/m;
const DEPLOY_JOB_CONDITION_PATTERN = /^ {2}(\w+):\n(?: {4}.*\n)*? {4}if: >-\n((?: {6}.*\n)+)/gm;

describe("Credential-free hosted quality workflow", () => {
  test("Pins every third-party action to an immutable commit", () => {
    const references = [...workflow.matchAll(ACTION_REFERENCE_PATTERN)].map((match) => match[1]);
    expect(references).toEqual([
      "3d3c42e5aac5ba805825da76410c181273ba90b1",
      "0c5077e51419868618aeaa5fe8019c62421857d6",
    ]);
    expect(
      references.every((reference) => IMMUTABLE_ACTION_REFERENCE_PATTERN.test(reference ?? ""))
    ).toBe(true);
  });

  test("Is read-only, cancellable, bounded, and revision-labelled", () => {
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain("timeout-minutes: 15");
    expect(workflow).toContain(`${TEMPLATE_DOLLAR}{GITHUB_SHA}`);
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("fetch-depth: 1");
  });

  test("Has no secret, provider, deployment, codegen, or authenticated lane", () => {
    const normalized = workflow.toLowerCase();
    for (const forbidden of [
      "secrets.",
      "convex deploy",
      "convex codegen",
      "convex dev",
      "vercel",
      "deploy key",
      "browser_smoke_",
      "e2e_password",
    ]) {
      expect(normalized).not.toContain(forbidden);
    }
    expect(workflow).not.toMatch(WORKFLOW_ENVIRONMENT_PATTERN);
  });

  test("Runs only lint, both typechecks, all tests, and coverage", () => {
    expect(workflow).toContain("bun install --frozen-lockfile");
    expect(workflow).toContain("run: bun run quality:target-neutral");
    expect(workflow).toContain("working-directory: citius-blog");
    expect(workflow).not.toContain("bun run build");
    expect(sharedQuality.match(/id: "/g)).toHaveLength(5);
    for (const required of [
      'args: ["run", "lint:all"]',
      'args: ["run", "typecheck"]',
      'args: ["run", "convex:typecheck"]',
      'args: ["run", "test"]',
      'args: ["run", "coverage:check"]',
    ]) {
      expect(sharedQuality).toContain(required);
    }
    expect(sharedQuality).not.toContain("bun run test -- config/release config/test");
    for (const excluded of [
      "diff:check",
      "assets:check",
      "automation:check",
      "ai:config-check",
      "audit-level",
      "studio-build",
      "performance:check",
    ]) {
      expect(sharedQuality).not.toContain(excluded);
    }
    expect(sharedQuality).toContain('export const PINNED_BUN_VERSION = "1.4.4"');
  });

  test("Installs the same Bun in every workflow as the package pin", () => {
    const pinned = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).engines.bun;
    for (const name of ["hosted-quality.yml", "vercel-deploy.yml"]) {
      const source = readFileSync(resolve(root, ".github/workflows", name), "utf8");
      const versions = [...source.matchAll(BUN_VERSION_PATTERN)].map((match) => match[1]);
      expect(versions.length, name).toBeGreaterThan(0);
      expect(versions, name).toEqual(versions.map(() => pinned));
    }
    expect(sharedQuality).toContain(`export const PINNED_BUN_VERSION = "${pinned}"`);
  });

  test("Reports the required check to the merge queue without deploying queue commits", () => {
    const triggers = workflow.match(TRIGGER_BLOCK_PATTERN)?.[1] ?? "";
    expect(triggers).toContain("  pull_request:\n");
    expect(triggers).toContain("  merge_group:\n    types: [checks_requested]\n");
    expect(triggers).toContain("  push:\n    branches:\n      - main\n");
    expect(workflow).toContain("name: Required quality");
    expect(workflow).toContain(
      `group: hosted-quality-${TEMPLATE_DOLLAR}{{ github.workflow }}-${TEMPLATE_DOLLAR}{{ github.ref }}`
    );

    const deploy = readFileSync(resolve(root, ".github/workflows/vercel-deploy.yml"), "utf8");
    const conditions = Object.fromEntries(
      [...deploy.matchAll(DEPLOY_JOB_CONDITION_PATTERN)].map((match) => [match[1], match[2]])
    );
    expect(Object.keys(conditions).sort()).toEqual(["preview", "production"]);
    expect(conditions.preview).toContain("github.event.workflow_run.event == 'pull_request'");
    expect(conditions.production).toContain("github.event.workflow_run.event == 'push'");
    for (const condition of Object.values(conditions)) {
      expect(condition).toContain("github.event.workflow_run.conclusion == 'success'");
      expect(condition).not.toContain("merge_group");
    }
  });
});
