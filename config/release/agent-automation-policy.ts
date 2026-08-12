import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { formatCliHelp, parseCliArguments } from "../commands/cli";

/**
 * Commands that can irreversibly change repository or deployment state require a separate,
 * human-readable approval record. This module only authorizes a command; it never executes one.
 * Agent runners should call `bun run automation:check -- <command>` before spawning a process.
 */

export const APPROVAL_POLICY_VERSION = 1;

const AUTOMATION_POLICY_CLI = {
  allowPositionals: true,
  command: "bun run automation:check --",
  description:
    "Classify one exact command against the local destructive-action consent policy. This checker never executes the command.",
  options: [],
} as const;

const DESTRUCTIVE_COMMANDS = [
  /(?:^|[;&|]\s*)git\s+(?:reset\s+--hard|clean\s+-f|checkout\s+--|restore\s+--source)/i,
  /(?:^|[;&|]\s*)git\s+push\b[^\n]*\s(?:--force(?:-with-lease)?|-f)(?:\s|$)/i,
  /(?:^|[;&|]\s*)rm\s+-[a-z]*r[a-z]*f[a-z]*(?:\s|$)/i,
  /(?:^|[;&|]\s*)find\b[^\n]*\s-delete(?:\s|$)/i,
  /(?:^|[;&|]\s*)bunx\s+convex\s+(?:deploy|env\s+set|run\s+--prod)\b/i,
  /(?:^|[;&|]\s*)(?:vercel|npx\s+vercel)\s+(?:deploy|rm|env\s+(?:add|rm|pull))\b/i,
] as const;

export interface ApprovalRecord {
  approvedAt: string;
  approvedBy: string;
  commandDigest: string;
  expiresAt: string;
  policyVersion: number;
  reason: string;
}

export interface AutomationDecision {
  allowed: boolean;
  destructive: boolean;
  reason: string;
}

export function normalizeCommand(command: string) {
  return command.trim().replace(/\s+/g, " ");
}

export function commandDigest(command: string) {
  return createHash("sha256").update(normalizeCommand(command)).digest("hex");
}

export function isDestructiveCommand(command: string) {
  const normalized = normalizeCommand(command);
  return DESTRUCTIVE_COMMANDS.some((pattern) => pattern.test(normalized));
}

function parseDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function authorizeAutomation(
  command: string,
  approval: ApprovalRecord | undefined,
  now = Date.now()
): AutomationDecision {
  const normalized = normalizeCommand(command);
  if (!normalized) {
    return { allowed: false, destructive: false, reason: "command is empty" };
  }

  const destructive = isDestructiveCommand(normalized);
  if (!destructive) {
    return { allowed: true, destructive: false, reason: "non-destructive command" };
  }

  if (!approval) {
    return { allowed: false, destructive: true, reason: "explicit approval record is required" };
  }
  if (approval.policyVersion !== APPROVAL_POLICY_VERSION) {
    return { allowed: false, destructive: true, reason: "approval policy version is unsupported" };
  }
  if (approval.commandDigest !== commandDigest(normalized)) {
    return { allowed: false, destructive: true, reason: "approval is for a different command" };
  }
  if (!(approval.approvedBy.trim() && approval.reason.trim())) {
    return {
      allowed: false,
      destructive: true,
      reason: "approval must name an approver and reason",
    };
  }

  const approvedAt = parseDate(approval.approvedAt);
  const expiresAt = parseDate(approval.expiresAt);
  if (approvedAt === null || expiresAt === null || approvedAt > now || expiresAt <= now) {
    return { allowed: false, destructive: true, reason: "approval window is invalid or expired" };
  }

  return { allowed: true, destructive: true, reason: "explicit approval record is valid" };
}

function readApproval(path: string | undefined) {
  if (!path) {
    return;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ApprovalRecord;
  } catch {
    // A missing or malformed record is treated as no consent.
  }
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), AUTOMATION_POLICY_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(AUTOMATION_POLICY_CLI));
    } else {
      const command = parsed.positionals.join(" ");
      if (!command) {
        throw new Error(
          "Automation check requires a command. Example: bun run automation:check -- git diff --check"
        );
      }
      const decision = authorizeAutomation(
        command,
        readApproval(process.env.AUTOMATION_APPROVAL_RECORD)
      );
      if (decision.allowed) {
        console.log(`Automation allowed: ${decision.reason}.`);
      } else {
        console.error(`Automation denied: ${decision.reason}.`);
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Automation check failed");
    process.exitCode = 1;
  }
}
