import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import type { JsonObject } from "../lib/jsonValue";
import {
  APPROVAL_POLICY_VERSION,
  authorizeAutomation,
  commandDigest,
  isDestructiveCommand,
  normalizeCommand,
} from "./agent-automation-policy";

const root = resolve(import.meta.dir, "../..");

const NOW = Date.parse("2026-08-05T12:00:00.000Z");

function approval(command: string, overrides: JsonObject = {}) {
  return {
    approvedAt: "2026-08-05T11:55:00.000Z",
    approvedBy: "director@example.com",
    commandDigest: commandDigest(command),
    expiresAt: "2026-08-05T12:30:00.000Z",
    policyVersion: APPROVAL_POLICY_VERSION,
    reason: "Approved for the documented recovery window.",
    ...overrides,
  };
}

describe("Agent automation consent policy", () => {
  test("Normalizes command whitespace before hashing and matching", () => {
    expect(normalizeCommand("  git   status\n")).toBe("git status");
    expect(commandDigest("git   status")).toBe(commandDigest(" git status "));
  });

  test("Classifies repository, filesystem, and deployment mutations as destructive", () => {
    for (const command of [
      "git reset --hard HEAD~1",
      "git push origin main --force-with-lease",
      "rm -rf ./tmp-artifacts",
      "find ./tmp-artifacts -type f -delete",
      "bunx convex deploy --cmd 'bun run build'",
      "bun config/release/vercel-convex-deploy.ts",
      "vercel env rm SECRET production",
    ]) {
      expect(isDestructiveCommand(command)).toBe(true);
    }
    expect(isDestructiveCommand("git diff --check")).toBe(false);
    expect(isDestructiveCommand("bun run test")).toBe(false);
  });

  test("Denies destructive automation without a recorded approval", () => {
    expect(authorizeAutomation("git reset --hard HEAD", undefined, NOW)).toEqual({
      allowed: false,
      destructive: true,
      reason: "explicit approval record is required",
    });
  });

  test("Requires an exact command, approver, reason, and live approval window", () => {
    const command = "git clean -fd ./tmp";
    expect(authorizeAutomation(command, approval(command), NOW).allowed).toBe(true);
    expect(authorizeAutomation(command, approval("git clean -fd ./other"), NOW).allowed).toBe(
      false
    );
    expect(authorizeAutomation(command, approval(command, { approvedBy: "" }), NOW).allowed).toBe(
      false
    );
    expect(
      authorizeAutomation(
        command,
        approval(command, { expiresAt: "2026-08-05T11:59:59.000Z" }),
        NOW
      ).allowed
    ).toBe(false);
  });

  test("Help exits before reading an approval record and an empty command fails with usage", () => {
    const run = (args: string[]) =>
      spawnSync("bun", ["config/release/agent-automation-policy.ts", ...args], {
        cwd: root,
        encoding: "utf8",
        env: {
          AUTOMATION_APPROVAL_RECORD: "/path/that/must/not/be/read",
          PATH: process.env.PATH,
        },
      });

    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Usage: bun run automation:check");

    const empty = run([]);
    expect(empty.status).toBe(1);
    expect(empty.stderr).toContain("requires a command");
  });
});
