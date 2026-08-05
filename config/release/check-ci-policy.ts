import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");
const WORKFLOW_PATH = resolve(ROOT, ".github/workflows/required-quality.yml");
const EXACT_BUN_VERSION = "1.3.14";
const ACTION_REFERENCE_PATTERN = /^\s*(?:-\s*)?uses:\s*([^\s#]+)\s*$/gm;
const IMMUTABLE_ACTION_PATTERN = /@[0-9a-f]{40}$/;
const BUN_VERSION_PATTERN = /^\s*bun-version:\s*(\S+)\s*$/m;
const RAW_BUN_TEST_PATTERN = /^\s*(?:-\s*)?run:\s*bun test\s*$/m;

interface SourceFile {
  path: string;
  source: string;
}

export interface PolicyFinding {
  line: number;
  path: string;
  rule: string;
}

interface SecretPattern {
  name: string;
  pattern: RegExp;
}

// These formats are deliberately high-confidence provider tokens or private-key headers. Generic
// words such as "secret" and "token" are not enough to report a finding: this scan must remain
// useful on test fixtures, documentation, and environment-variable references.
const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "private-key-header",
    pattern: /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/,
  },
  { name: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: "github-fine-grained-token", pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { name: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: "stripe-or-razorpay-key", pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { name: "openai-key", pattern: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/ },
  { name: "resend-key", pattern: /\bre_[A-Za-z0-9_-]{24,}\b/ },
  {
    name: "sendgrid-key",
    pattern: /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  },
  { name: "npm-token", pattern: /\bnpm_[A-Za-z0-9]{36}\b/ },
];

function lineNumberAt(source: string, offset: number) {
  return source.slice(0, offset).split("\n").length;
}

export function findSecretMatches(files: SourceFile[]): PolicyFinding[] {
  const findings: PolicyFinding[] = [];

  for (const file of files) {
    // The checked-in example is required to contain key names with empty values. Keeping it out
    // of this value scanner makes that contract explicit while .env* value files remain blocked by
    // diff hygiene.
    if (file.path === ".env.example") {
      continue;
    }
    if (file.source.includes("\0")) {
      continue;
    }

    for (const { name, pattern } of SECRET_PATTERNS) {
      for (const match of file.source.matchAll(
        new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`)
      )) {
        const offset = match.index ?? 0;
        findings.push({ line: lineNumberAt(file.source, offset), path: file.path, rule: name });
      }
    }
  }

  return findings.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.line - right.line ||
      left.rule.localeCompare(right.rule)
  );
}

function actionReferences(workflow: string) {
  return [...workflow.matchAll(ACTION_REFERENCE_PATTERN)].map((match) => match[1] ?? "");
}

export function findWorkflowPolicyViolations(workflow: string, bunVersion = EXACT_BUN_VERSION) {
  const violations: string[] = [];

  if (!workflow.includes("permissions:\n  contents: read")) {
    violations.push("required-quality workflow must grant contents: read explicitly");
  }
  if (workflow.includes("pull_request_target")) {
    violations.push("required-quality workflow must not use pull_request_target");
  }
  for (const actionRef of actionReferences(workflow)) {
    if (
      !(
        actionRef.startsWith("./") ||
        actionRef.startsWith("docker://") ||
        IMMUTABLE_ACTION_PATTERN.test(actionRef)
      )
    ) {
      violations.push(`workflow action must use an immutable commit: ${actionRef}`);
    }
  }

  const configuredBunVersion = workflow.match(BUN_VERSION_PATTERN)?.[1];
  if (configuredBunVersion !== bunVersion) {
    violations.push(`workflow must pin Bun to ${bunVersion}`);
  }
  if (RAW_BUN_TEST_PATTERN.test(workflow)) {
    violations.push("workflow must use bun run test so the repository test policy is applied");
  }
  const codegenStep = workflow.indexOf("bunx convex codegen --typecheck enable");
  const testStep = workflow.indexOf("run: bun run test");
  if (codegenStep < 0 || testStep < 0 || codegenStep >= testStep) {
    violations.push("fresh Convex codegen must run before bun run test");
  }

  return [...new Set(violations)].sort((left, right) => left.localeCompare(right));
}

function trackedSourceFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  if (result.error) {
    throw new Error("Unable to enumerate tracked files for secret scanning", {
      cause: result.error,
    });
  }
  if (result.status !== 0 || result.signal) {
    throw new Error(
      `Unable to enumerate tracked files for secret scanning (status=${result.status ?? "null"}, signal=${result.signal ?? "none"})`
    );
  }

  return result.stdout
    .split("\0")
    .filter(Boolean)
    .flatMap((path): SourceFile[] => {
      try {
        return [{ path, source: readFileSync(resolve(ROOT, path), "utf8") }];
      } catch (error) {
        // Git can contain a submodule or a platform-specific path that is not readable in the
        // runner. A missing source must not silently pass the policy check.
        throw new Error(`Unable to read tracked file for secret scanning: ${path}`, {
          cause: error,
        });
      }
    });
}

export function evaluateCiPolicy({ workflow, files }: { workflow: string; files: SourceFile[] }) {
  return {
    secrets: findSecretMatches(files),
    workflow: findWorkflowPolicyViolations(workflow),
  };
}

if (import.meta.main) {
  const workflow = readFileSync(WORKFLOW_PATH, "utf8");
  const findings = evaluateCiPolicy({ files: trackedSourceFiles(), workflow });
  if (findings.workflow.length === 0 && findings.secrets.length === 0) {
    console.log(
      "CI and secret policy passed: workflow pins and high-confidence secret scan are clean."
    );
  } else {
    console.error("CI and secret policy failed:");
    for (const violation of findings.workflow) {
      console.error(`- ${violation}`);
    }
    for (const finding of findings.secrets) {
      console.error(`- ${finding.path}:${finding.line} matches ${finding.rule}`);
    }
    process.exitCode = 1;
  }
}
