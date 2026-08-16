import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createCommandManifest } from "./manifest";

const root = resolve(import.meta.dir, "../..");

function runManifest(args: string[]) {
  return spawnSync("bun", ["config/commands/manifest.ts", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });
}

describe("repository command manifest", () => {
  test("derives one sorted discovery surface from package scripts", () => {
    const manifest = createCommandManifest({
      build: "next build",
      "dev:doctor": "bun config/dev/doctor.ts",
      test: "bun test",
    });

    expect(manifest).toEqual([
      { command: "bun run build", group: "Build and release", script: "next build" },
      {
        command: "bun run dev:doctor",
        group: "Local development",
        script: "bun config/dev/doctor.ts",
      },
      { command: "bun run test", group: "Quality", script: "bun test" },
    ]);
  });

  test("help and invalid flags never execute a package script", () => {
    const help = runManifest(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Usage: bun run help -- [options]");
    expect(help.stdout).not.toContain("CONVEX_DEPLOYMENT");

    const invalid = runManifest(["--live"]);
    expect(invalid.status).not.toBe(0);
    expect(invalid.stderr).toContain("Unknown flag --live");
  });

  test("supports a deterministic JSON view", () => {
    const result = runManifest(["--json"]);
    expect(result.status).toBe(0);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const parsed = JSON.parse(result.stdout) as Array<{ command: string }>;
    expect(parsed.some((entry) => entry.command === "bun run help")).toBe(true);
    expect(parsed.some((entry) => entry.command === "bun run verify:local")).toBe(true);
  });
});
