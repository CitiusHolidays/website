import { describe, expect, test } from "bun:test";
import {
  APPROVAL_POLICY_VERSION,
  authorizeAutomation,
  commandDigest,
  isDestructiveCommand,
  normalizeCommand,
} from "./agent-automation-policy";

const NOW = Date.parse("2026-08-05T12:00:00.000Z");

function approval(command: string, overrides: Record<string, unknown> = {}) {
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

describe("agent automation consent policy", () => {
  test("normalizes command whitespace before hashing and matching", () => {
    expect(normalizeCommand("  git   status\n")).toBe("git status");
    expect(commandDigest("git   status")).toBe(commandDigest(" git status "));
  });

  test("classifies repository, filesystem, and deployment mutations as destructive", () => {
    for (const command of [
      "git reset --hard HEAD~1",
      "git push origin main --force-with-lease",
      "rm -rf ./tmp-artifacts",
      "find ./tmp-artifacts -type f -delete",
      "bunx convex deploy --cmd 'bun run build'",
      "vercel env rm SECRET production",
    ]) {
      expect(isDestructiveCommand(command)).toBe(true);
    }
    expect(isDestructiveCommand("git diff --check")).toBe(false);
    expect(isDestructiveCommand("bun run test")).toBe(false);
  });

  test("denies destructive automation without a recorded approval", () => {
    expect(authorizeAutomation("git reset --hard HEAD", undefined, NOW)).toEqual({
      allowed: false,
      destructive: true,
      reason: "explicit approval record is required",
    });
  });

  test("requires an exact command, approver, reason, and live approval window", () => {
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
});
