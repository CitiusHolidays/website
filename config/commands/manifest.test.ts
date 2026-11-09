import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { fromPartial } from "@total-typescript/shoehorn";
import { CHILD_TEST_TIMEOUT_MS, runChild } from "../../test-helpers/runChild";
import { createCommandManifest } from "./manifest";

const root = resolve(import.meta.dir, "../..");

function runManifest(args: string[]) {
  return runChild("bun", ["config/commands/manifest.ts", ...args], {
    cwd: root,
    env: { PATH: process.env.PATH },
  });
}

describe("Repository command manifest", () => {
  test("Derives one sorted discovery surface from package scripts", () => {
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

  test(
    "Help and invalid flags never execute a package script",
    async () => {
      const help = await runManifest(["--help"]);
      expect(help.status).toBe(0);
      expect(help.stdout).toContain("Usage: bun run help -- [options]");
      expect(help.stdout).not.toContain("CONVEX_DEPLOYMENT");

      const invalid = await runManifest(["--live"]);
      expect(invalid.status).not.toBe(0);
      expect(invalid.stderr).toContain("Unknown flag --live");
    },
    CHILD_TEST_TIMEOUT_MS
  );

  test(
    "Supports a deterministic JSON view",
    async () => {
      const result = await runManifest(["--json"]);
      expect(result.status).toBe(0);
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const parsed = fromPartial<Array<{ command: string }>>(JSON.parse(result.stdout));
      expect(parsed.some((entry) => entry.command === "bun run help")).toBe(true);
      expect(parsed.some((entry) => entry.command === "bun run verify:local")).toBe(true);
    },
    CHILD_TEST_TIMEOUT_MS
  );
});
