import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");
const MAX_CHANGED_FILE_BYTES = 10 * 1024 * 1024;
const diffBase = process.env.DIFF_BASE?.trim();
const ENV_VALUE_FILE_PATTERN = /^\.env\./;
const AGENT_TOOL_PREFIXES = [".agents/skills/", ".claude/hooks/", ".claude/skills/"] as const;
const PRODUCT_PREFIXES = ["convex/", "docs/adr/", "docs/prd/", "src/"] as const;
const PRODUCT_ROOT_FILES = new Set([
  "CONTEXT.md",
  "CONTEXT-MAP.md",
  "DESIGN.md",
  "biome.json",
  "bun.lock",
  "next.config.mjs",
  "package.json",
  "tsconfig.json",
  "vercel.json",
]);

interface AtomicReplacement {
  deletedPath: string;
  successorPaths: string[];
}

interface AtomicReplacementManifest {
  replacements: AtomicReplacement[];
  schemaVersion: number;
}

interface DiffEntry {
  path: string;
  previousPath?: string;
  status: string;
}

export function classifyIntegrationUnit(paths: string[], couplingNote = "") {
  const agentToolPaths = paths.filter((path) =>
    AGENT_TOOL_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
  const productPaths = paths.filter(
    (path) =>
      PRODUCT_ROOT_FILES.has(path) || PRODUCT_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
  const mixed = agentToolPaths.length > 0 && productPaths.length > 0;
  const couplingAcknowledged = mixed && couplingNote.trim().length > 0;
  return {
    advisory: mixed && !couplingAcknowledged,
    agentToolPaths,
    couplingAcknowledged,
    mixed,
    productPaths,
  };
}

function runGit(args: string[], allowFailure = false) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (!allowFailure && result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result;
}

function nulPaths(result: ReturnType<typeof runGit>) {
  return result.stdout.split("\0").filter(Boolean);
}

function parseNameStatus(result: ReturnType<typeof runGit>): DiffEntry[] {
  const fields = nulPaths(result);
  const entries: DiffEntry[] = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index] ?? "";
    index += 1;
    if (status.startsWith("R") || status.startsWith("C")) {
      const previousPath = fields[index];
      const path = fields[index + 1];
      index += 2;
      if (previousPath && path) {
        entries.push({ path, previousPath, status: status[0] ?? status });
      }
      continue;
    }
    const path = fields[index];
    index += 1;
    if (path) {
      entries.push({ path, status: status[0] ?? status });
    }
  }
  return entries;
}

function diffEntries() {
  if (diffBase) {
    return parseNameStatus(runGit(["diff", "--name-status", "-z", `${diffBase}...HEAD`]));
  }
  return [
    ...parseNameStatus(runGit(["diff", "--name-status", "-z"])),
    ...parseNameStatus(runGit(["diff", "--cached", "--name-status", "-z"])),
  ];
}

function untrackedPaths() {
  return diffBase ? [] : nulPaths(runGit(["ls-files", "--others", "--exclude-standard", "-z"]));
}

function loadAtomicReplacements(): AtomicReplacement[] {
  // SAFETY: only the repository-owned manifest fields declared by DiffHygieneManifest are consumed below.
  const manifest = JSON.parse(
    readFileSync(resolve(ROOT, "config/release/atomic-replacements.json"), "utf8")
  ) as AtomicReplacementManifest;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.replacements)) {
    throw new Error("Unsupported atomic replacement manifest");
  }
  for (const replacement of manifest.replacements) {
    if (
      !(replacement.deletedPath && Array.isArray(replacement.successorPaths)) ||
      replacement.successorPaths.length === 0
    ) {
      throw new Error("Atomic replacements require a deleted path and at least one successor");
    }
  }
  return manifest.replacements;
}

function checkWhitespace() {
  const checks = diffBase
    ? [["diff", "--check", `${diffBase}...HEAD`]]
    : [
        ["diff", "--check"],
        ["diff", "--cached", "--check"],
      ];
  const failures = checks.flatMap((args) => {
    const result = runGit(args, true);
    return result.status === 0 ? [] : [result.stdout.trim() || result.stderr];
  });
  return failures;
}

function forbiddenReason(path: string) {
  if (path === ".env" || (ENV_VALUE_FILE_PATTERN.test(path) && path !== ".env.example")) {
    return "environment value files must not be committed";
  }
  if (path === ".DS_Store" || path.endsWith("/.DS_Store")) {
    return "OS metadata must not be committed";
  }
  if (
    path.startsWith(".next/") ||
    path.startsWith("node_modules/") ||
    path.startsWith("convex/_generated/") ||
    path.startsWith("convex/betterAuth/_generated/")
  ) {
    return "generated output must not be committed";
  }
  return null;
}

function main() {
  const entries = diffEntries();
  const changedPaths = new Set([
    ...entries.flatMap((entry) => (entry.status === "D" ? [] : [entry.path])),
    ...untrackedPaths(),
  ]);
  const replacedPaths = new Set(
    entries.flatMap((entry) => {
      if (entry.status === "D") {
        return [entry.path];
      }
      return entry.status === "R" && entry.previousPath ? [entry.previousPath] : [];
    })
  );
  const failures = checkWhitespace();
  for (const replacement of loadAtomicReplacements()) {
    if (
      replacedPaths.has(replacement.deletedPath) &&
      !replacement.successorPaths.some((path) => changedPaths.has(path))
    ) {
      failures.push(
        `${replacement.deletedPath}: deleted or renamed without atomic successor (${replacement.successorPaths.join(
          " or "
        )})`
      );
    }
  }

  for (const path of changedPaths) {
    const reason = forbiddenReason(path);
    if (reason) {
      failures.push(`${path}: ${reason}`);
      continue;
    }
    const absolutePath = resolve(ROOT, path);
    if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
      const bytes = statSync(absolutePath).size;
      if (bytes > MAX_CHANGED_FILE_BYTES) {
        failures.push(`${path}: ${bytes} bytes exceeds the 10 MiB changed-file limit`);
      }
    }
  }

  const partition = classifyIntegrationUnit(
    Array.from(changedPaths),
    process.env.AGENT_TOOL_COUPLING_NOTE
  );
  if (partition.advisory) {
    console.warn(
      "Advisory: this range mixes agent-tool synchronization with product/application paths. Prefer separate buildable integration units, or record the direct coupling in the commit/PR body (AGENT_TOOL_COUPLING_NOTE acknowledges a reviewed local exception)."
    );
  } else if (partition.couplingAcknowledged) {
    console.warn("Advisory acknowledged: mixed agent-tool/product coupling note is present.");
  }

  if (failures.length > 0) {
    console.error("Diff hygiene failed:");
    for (const failure of failures) {
      console.error(`  ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log(
      "Diff hygiene passed: atomic replacements, whitespace, secret-file, generated-output, and size checks are clean."
    );
  }
}

if (import.meta.main) {
  main();
}
