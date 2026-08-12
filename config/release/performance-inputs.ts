import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css"];
const IMPORT_SPECIFIER_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s*)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

const STAFF_WORKSPACE_PERFORMANCE_ROOTS = [
  "config/release/check-performance-budgets.ts",
  "config/release/staff-workspace-performance-budget.ts",
  "e2e/specs/staff-workspace-performance.spec.ts",
  "src/components/portal/PortalShell.tsx",
  "src/components/portal/PortalWorkspace.tsx",
  "src/components/portal/SelectableDataTable.tsx",
  "src/components/portal/workspace/portalLazyViews.tsx",
  "src/components/portal/workspace/portalRouteLifecycle.tsx",
  "src/components/portal/workspace/QueriesView.tsx",
  "src/components/portal/workspace/ProposalsView.tsx",
  "src/components/portal/workspace/operations/JobCardsView.tsx",
  "src/components/portal/workspace/usePortalWorkspaceData.ts",
  "src/lib/portal/navigationPerformance.ts",
  "src/lib/portal/portalRouteManifest.ts",
  "convex/crm/jobCardReads.ts",
  "convex/crm/jobCards.ts",
  "convex/crm/proposalLinkProjection.ts",
  "convex/crm/proposals.ts",
  "convex/crm/queryReads.ts",
  "convex/crm/queries.ts",
] as const;

const PUBLIC_RUNTIME_PERFORMANCE_ROOTS = [
  "config/release/check-performance-budgets.ts",
  "config/release/public-runtime-performance.ts",
  "scripts/public-runtime-performance.ts",
  "src/app/(public)/layout.js",
  "src/app/(public)/page.js",
  "src/app/(public)/pilgrimage/page.client.js",
  "src/app/(public)/pilgrimage/page.js",
  "src/app/(public)/sacred-bharat/page.client.js",
  "src/app/(public)/sacred-bharat/page.js",
  "src/components/pages/HeroVideo.js",
  "src/components/pages/HomeHeroClient.js",
  "src/lib/publicMediaPolicy.ts",
] as const;

const SHARED_BUILD_INPUTS = ["bun.lock", "next.config.mjs", "package.json"] as const;

function normalizePath(root: string, path: string) {
  return relative(root, path).split(sep).join("/");
}

function resolveSourcePath(root: string, importer: string, specifier: string) {
  if (specifier.startsWith("convex/_generated/") || specifier.includes("/convex/_generated/")) {
    return null;
  }
  let candidate: string;
  if (specifier.startsWith("@/")) {
    candidate = resolve(root, "src", specifier.slice(2));
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    candidate = resolve(dirname(importer), specifier);
  } else {
    return null;
  }
  const candidates = extname(candidate)
    ? [candidate]
    : [
        candidate,
        ...SOURCE_EXTENSIONS.map((extension) => `${candidate}${extension}`),
        ...SOURCE_EXTENSIONS.map((extension) => resolve(candidate, `index${extension}`)),
      ];
  return (
    candidates.find((path) => {
      try {
        return existsSync(path) && statSync(path).isFile();
      } catch {
        return false;
      }
    }) ?? null
  );
}

export function collectLocalImportClosure(root: string, roots: readonly string[]) {
  const repositoryRoot = resolve(root);
  const pending = roots.map((path) => resolve(repositoryRoot, path));
  const visited = new Set<string>();

  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || visited.has(path)) {
      continue;
    }
    if (!(existsSync(path) && statSync(path).isFile())) {
      throw new Error(`Performance input is missing: ${normalizePath(repositoryRoot, path)}`);
    }
    if (!path.startsWith(`${repositoryRoot}${sep}`)) {
      throw new Error(`Performance input escapes repository root: ${path}`);
    }
    visited.add(path);
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(IMPORT_SPECIFIER_PATTERN)) {
      const imported = resolveSourcePath(repositoryRoot, path, match[1] ?? match[2] ?? "");
      if (imported && !visited.has(imported)) {
        pending.push(imported);
      }
    }
  }

  return [...visited]
    .map((path) => normalizePath(repositoryRoot, path))
    .sort((left, right) => left.localeCompare(right));
}

function performanceInputs(root: string, roots: readonly string[]) {
  return [...new Set([...SHARED_BUILD_INPUTS, ...collectLocalImportClosure(root, roots)])].sort();
}

export function staffWorkspacePerformanceInputs(root: string) {
  return performanceInputs(root, STAFF_WORKSPACE_PERFORMANCE_ROOTS);
}

export function publicRuntimePerformanceInputs(root: string) {
  return performanceInputs(root, PUBLIC_RUNTIME_PERFORMANCE_ROOTS);
}

export function hasExactPerformanceInputs(recorded: readonly string[], current: readonly string[]) {
  return (
    recorded.length === current.length && recorded.every((path, index) => path === current[index])
  );
}
