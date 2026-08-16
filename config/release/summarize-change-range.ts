import { spawnSync } from "node:child_process";
import { isRuntimeString } from "../../src/lib/runtimeValues";
import { formatCliHelp, parseCliArguments } from "../commands/cli";

export interface ChangeNumstatRow {
  added: number;
  binary: boolean;
  deleted: number;
  path: string;
}

export interface ChangeNameStatus {
  from?: string;
  path: string;
  status: "added" | "copied" | "deleted" | "modified" | "renamed" | "unknown";
}

interface ChangeCommit {
  sha: string;
  subject: string;
}

interface ChangeSummaryInput {
  base: string;
  commits: ChangeCommit[];
  head: string;
  nameStatuses: ChangeNameStatus[];
  numstat: ChangeNumstatRow[];
  recentPaths: string[];
}

interface RiskDefinition {
  commands: string[];
  pattern: RegExp;
  tag: string;
}

const RELEASE_SCOPE_CLI = {
  command: "bun run release:scope --",
  description:
    "Summarize an explicit Git change range without reading file contents or contacting a target.",
  options: [
    { description: "Required ancestor commit or ref", name: "base", type: "string" },
    { description: "Head commit or ref (default: HEAD)", name: "head", type: "string" },
    { description: "Emit machine-readable JSON only", name: "json", type: "boolean" },
  ],
} as const;

const RISK_DEFINITIONS: readonly RiskDefinition[] = [
  {
    commands: ["bun run convex:typecheck", "bun run test"],
    pattern: /(^|\/)(auth|betterAuth)|auth-|staffUsers|userProfiles/i,
    tag: "auth",
  },
  {
    commands: ["bun run convex:typecheck", "bun run test"],
    pattern: /^convex\//,
    tag: "backend",
  },
  {
    commands: ["bun run docs:check"],
    pattern: /(^docs\/|\.md$|^diagrams\/)/,
    tag: "documentation",
  },
  {
    commands: ["bun run typecheck", "bun run test"],
    pattern: /^src\/(app|components|hooks|lib)\//,
    tag: "frontend",
  },
  {
    commands: ["bun run test"],
    pattern: /(commercialFiles|attachment|upload|storage|fileAccess|files\.)/i,
    tag: "files",
  },
  {
    commands: ["bun run convex:typecheck", "bun run test"],
    pattern: /(import|export|spreadsheet)/i,
    tag: "imports-exports",
  },
  {
    commands: ["bun run convex:typecheck", "bun run test"],
    pattern: /(notification|email)/i,
    tag: "notifications",
  },
  {
    commands: ["bun run convex:typecheck", "bun run test"],
    pattern: /(payment|razorpay|reconciliation)/i,
    tag: "payments",
  },
  {
    commands: ["bun run performance:check"],
    pattern: /(performance|portalRouteManifest|usePortalWorkspaceData|pagination)/i,
    tag: "performance",
  },
  {
    commands: ["bun run convex:typecheck", "bun run test"],
    pattern: /(permission|rolePolicy|authz|accessPolicy)/i,
    tag: "permissions",
  },
  {
    commands: ["bun run config:check"],
    pattern:
      /(^config\/release\/|^scripts\/|^RELEASE\.md$|^vercel\.json$|^package\.json$|^bun\.lock$)/,
    tag: "release-tooling",
  },
  {
    commands: ["bun run convex:typecheck", "bun run test"],
    pattern: /(^convex\/schema\.|\/migrations?\/|migration)/i,
    tag: "schema-migrations",
  },
  {
    commands: ["bun run typecheck", "bun run convex:typecheck", "bun run test"],
    pattern: /(^src\/components\/portal\/|^src\/lib\/portal\/|^convex\/crm\/)/,
    tag: "staff-workspace",
  },
] as const;

const STATUS_NAMES = {
  A: "added",
  C: "copied",
  D: "deleted",
  M: "modified",
  R: "renamed",
} satisfies Record<string, ChangeNameStatus["status"]>;

const AGENT_TOOLING_PATH_PATTERN = /^(\.agents\/|\.claude\/|AGENTS\.md$|CLAUDE\.md$)/;
const CONVENTIONAL_COMMIT_PATTERN =
  /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([^)]+\))?!?:\s/;
const DOCUMENTATION_PATH_PATTERN = /^(docs\/|diagrams\/)|\.md$/;
const RELEASE_TOOLING_PATH_PATTERN =
  /^(config\/release\/|scripts\/|package\.json$|bun\.lock$|vercel\.json$)/;
const REVERT_COMMIT_PATTERN = /^revert(?::|\s)/i;
const TEST_PATH_PATTERN = /(^e2e\/|\.(test|spec)\.[cm]?[jt]sx?$|\/(tests?|__tests__)\/)/;

function isTestPath(path: string) {
  return TEST_PATH_PATTERN.test(path);
}

function ownershipArea(path: string) {
  if (AGENT_TOOLING_PATH_PATTERN.test(path)) {
    return "agent-tooling";
  }
  if (path.startsWith("src/")) {
    return "application";
  }
  if (path.startsWith("convex/")) {
    return "backend";
  }
  if (path.startsWith("e2e/")) {
    return "e2e";
  }
  if (path.startsWith("citius-blog/")) {
    return "studio";
  }
  if (RELEASE_TOOLING_PATH_PATTERN.test(path)) {
    return "release-tooling";
  }
  if (DOCUMENTATION_PATH_PATTERN.test(path)) {
    return "documentation";
  }
  return "repository-config";
}

export function parseNumstat(output: string): ChangeNumstatRow[] {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [addedValue, deletedValue, ...pathParts] = line.split("\t");
      if (!(addedValue && deletedValue) || pathParts.length === 0) {
        throw new Error(`Malformed Git numstat row: ${line}`);
      }
      const binary = addedValue === "-" || deletedValue === "-";
      return {
        added: binary ? 0 : Number(addedValue),
        binary,
        deleted: binary ? 0 : Number(deletedValue),
        path: pathParts.join("\t"),
      };
    });
}

export function parseNameStatus(output: string): ChangeNameStatus[] {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [rawStatus = "", firstPath, secondPath] = line.split("\t");
      if (!firstPath) {
        throw new Error(`Malformed Git name-status row: ${line}`);
      }
      const statusCode = rawStatus[0] ?? "";
      const status = STATUS_NAMES[statusCode] ?? "unknown";
      if ((status === "renamed" || status === "copied") && secondPath) {
        return { from: firstPath, path: secondPath, status };
      }
      return { path: firstPath, status };
    });
}

function reviewLoad(files: number, lines: number) {
  if (files <= 5 && lines <= 300) {
    return "compact" as const;
  }
  if (files <= 25 && lines <= 1500) {
    return "moderate" as const;
  }
  if (files <= 100 && lines <= 7500) {
    return "large" as const;
  }
  return "extra-large" as const;
}

function stableUnique(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function summarizeChangeRows(input: ChangeSummaryInput) {
  if (input.numstat.length === 0 && input.commits.length === 0) {
    throw new Error("The requested change range is empty");
  }
  const rawAdded = input.numstat.reduce((sum, row) => sum + row.added, 0);
  const rawDeleted = input.numstat.reduce((sum, row) => sum + row.deleted, 0);
  const rawChanged = rawAdded + rawDeleted;
  const testRows = input.numstat.filter((row) => isTestPath(row.path));
  const testLines = testRows.reduce((sum, row) => sum + row.added + row.deleted, 0);
  const ownership = new Map<string, { files: number; lines: number }>();
  for (const row of input.numstat) {
    const area = ownershipArea(row.path);
    const current = ownership.get(area) ?? { files: 0, lines: 0 };
    current.files += 1;
    current.lines += row.added + row.deleted;
    ownership.set(area, current);
  }
  const paths = stableUnique(input.numstat.map((row) => row.path));
  const risks = RISK_DEFINITIONS.flatMap((definition) => {
    const reasons = paths.filter((path) => definition.pattern.test(path));
    definition.pattern.lastIndex = 0;
    return reasons.length > 0 ? [{ reasons: reasons.slice(0, 12), tag: definition.tag }] : [];
  });
  const commands = stableUnique([
    ...risks.flatMap(
      (risk) => RISK_DEFINITIONS.find((definition) => definition.tag === risk.tag)?.commands ?? []
    ),
    "bun run diff:check",
    ...(risks.some((risk) => risk.tag !== "documentation") ? ["bun run verify:local"] : []),
  ]);
  const hotspotCounts = new Map<string, number>();
  for (const path of input.recentPaths) {
    hotspotCounts.set(path, (hotspotCounts.get(path) ?? 0) + 1);
  }

  return {
    base: input.base,
    commits: {
      conventional: input.commits.filter((commit) =>
        CONVENTIONAL_COMMIT_PATTERN.test(commit.subject)
      ).length,
      reverts: input.commits
        .filter((commit) => REVERT_COMMIT_PATTERN.test(commit.subject))
        .map((commit) => commit.sha),
      total: input.commits.length,
      untyped: input.commits.filter((commit) => !CONVENTIONAL_COMMIT_PATTERN.test(commit.subject))
        .length,
    },
    files: {
      added: input.nameStatuses.filter((row) => row.status === "added").length,
      binary: input.numstat.filter((row) => row.binary).length,
      deleted: input.nameStatuses.filter((row) => row.status === "deleted").length,
      renamed: input.nameStatuses.filter((row) => row.status === "renamed").length,
      total: input.numstat.length,
    },
    head: input.head,
    hotspots: [...hotspotCounts.entries()]
      .sort(
        ([leftPath, left], [rightPath, right]) => right - left || leftPath.localeCompare(rightPath)
      )
      .slice(0, 10)
      .map(([path, touches]) => ({ path, touches })),
    lines: { added: rawAdded, deleted: rawDeleted, rawChanged },
    mixing: {
      toolchainAndProduct:
        paths.some((path) => ownershipArea(path) === "agent-tooling") &&
        paths.some((path) => ["application", "backend"].includes(ownershipArea(path))),
    },
    ownership: [...ownership.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([area, value]) => ({ area, ...value })),
    reviewLoad: reviewLoad(input.numstat.length, rawChanged),
    risks,
    schemaVersion: 1 as const,
    suggestedCommands: commands,
    tests: {
      files: testRows.length,
      lineRatio: rawChanged === 0 ? 0 : Number((testLines / rawChanged).toFixed(4)),
      lines: testLines,
    },
  };
}

function runGit(root: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout).trim() || `git ${args[0]} failed`);
  }
  return result.stdout;
}

function resolveCommit(root: string, reference: string, label: string) {
  try {
    return runGit(root, ["rev-parse", "--verify", `${reference}^{commit}`]).trim();
  } catch (error) {
    throw new Error(`Invalid ${label} revision: ${reference}`, { cause: error });
  }
}

export function collectChangeRangeSummary(
  root: string,
  baseReference: string,
  headReference = "HEAD"
) {
  const base = resolveCommit(root, baseReference, "base");
  const head = resolveCommit(root, headReference, "head");
  if (base === head) {
    throw new Error("The requested change range is empty");
  }
  try {
    runGit(root, ["merge-base", "--is-ancestor", base, head]);
  } catch (error) {
    throw new Error("The requested base and head do not form an ancestor change range", {
      cause: error,
    });
  }
  const commits = runGit(root, ["log", "--format=%H%x09%s", `${base}..${head}`])
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("\t");
      return { sha: line.slice(0, separator), subject: line.slice(separator + 1) };
    });
  const recentPaths = runGit(root, ["log", "-n", "25", "--name-only", "--format=", head])
    .split("\n")
    .filter(Boolean);
  return summarizeChangeRows({
    base,
    commits,
    head,
    nameStatuses: parseNameStatus(
      runGit(root, ["diff", "--name-status", "--find-renames", base, head])
    ),
    numstat: parseNumstat(runGit(root, ["diff", "--numstat", "--find-renames", base, head])),
    recentPaths,
  });
}

function renderHumanSummary(summary: ReturnType<typeof summarizeChangeRows>) {
  return [
    `Release range: ${summary.base}..${summary.head}`,
    `Review load: ${summary.reviewLoad}`,
    `Commits: ${summary.commits.total} (${summary.commits.conventional} conventional, ${summary.commits.untyped} untyped)`,
    `Files: ${summary.files.total} (${summary.files.added} added, ${summary.files.deleted} deleted, ${summary.files.renamed} renamed, ${summary.files.binary} binary)`,
    `Raw changed lines: ${summary.lines.rawChanged} (+${summary.lines.added}/-${summary.lines.deleted})`,
    `Tests: ${summary.tests.files} files, ${summary.tests.lines} lines, ${(summary.tests.lineRatio * 100).toFixed(1 as const)}% of changed lines`,
    `Ownership: ${summary.ownership.map((row) => `${row.area}=${row.files} files/${row.lines} lines`).join(", ")}`,
    `Risk tags: ${summary.risks.map((risk) => risk.tag).join(", ") || "none"}`,
    `Toolchain/product mixing: ${summary.mixing.toolchainAndProduct ? "yes (advisory)" : "no"}`,
    `Suggested local proof: ${summary.suggestedCommands.join("; ")}`,
    "Scope: read-only local Git evidence; no target, deployment, or production proof.",
  ].join("\n");
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), RELEASE_SCOPE_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(RELEASE_SCOPE_CLI));
    } else {
      const { base } = parsed.values;
      if (!isRuntimeString(base)) {
        throw new Error("--base is required");
      }
      const summary = collectChangeRangeSummary(
        process.cwd(),
        base,
        isRuntimeString(parsed.values.head) ? parsed.values.head : "HEAD"
      );
      console.log(
        parsed.values.json ? JSON.stringify(summary, null, 2) : renderHumanSummary(summary)
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Release range summary failed");
    process.exitCode = 1;
  }
}
