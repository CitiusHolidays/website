import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import {
  DIRECTOR_PERMISSIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "../../convex/crm/lib/rolePolicy";

const ROOT = resolve(import.meta.dir, "../..");
const MARKDOWN_LINK_PATTERN = /!?\[[^\]]*\]\(([^)]+)\)/g;
const BACKTICK_PATTERN = /`([^`\n]+)`/g;
const EXTERNAL_LINK_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|#)/i;
const LINK_TARGET_BOUNDARY_PATTERN = /^<|>$/g;
const PATH_EXCEPTION_PATTERN = /[*<>{}$]|\.\.\./;
const REPOSITORY_PATH_PATTERN = /(?:^|\/)\.?[\w()[\]@+-]+(?:\.[\w-]+)?(?:\/|$)/;
const TRAILING_PATH_PUNCTUATION_PATTERN = /[.,;:]$/;
const WHITESPACE_PATTERN = /\s+/;
const REQUIRED_DIAGRAM_EXTENSIONS = [".excalidraw", ".mmd", ".png", ".svg"] as const;

function read(path: string) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function markdownFiles(directory: string): string[] {
  return readdirSync(resolve(ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      return markdownFiles(path);
    }
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

function localMarkdownTarget(sourcePath: string, rawTarget: string) {
  const [withoutTitle = ""] = rawTarget
    .trim()
    .replace(LINK_TARGET_BOUNDARY_PATTERN, "")
    .split(WHITESPACE_PATTERN);
  const [withoutAnchor = ""] = withoutTitle.split("#");
  const fileTarget = decodeURIComponent(withoutAnchor);
  if (!fileTarget || EXTERNAL_LINK_PATTERN.test(fileTarget)) {
    return null;
  }
  return resolve(ROOT, dirname(sourcePath), fileTarget);
}

describe("documentation authority", () => {
  test("catalogs every maintained docs page and keeps local links resolvable", () => {
    const docsIndex = read("docs/README.md");
    const maintainedDocs = markdownFiles("docs");

    for (const path of maintainedDocs) {
      if (path !== "docs/README.md") {
        expect(docsIndex).toContain(`](${relative("docs", path)})`);
      }
    }

    for (const sourcePath of [
      "README.md",
      "RELEASE.md",
      "AGENTS.md",
      "CLAUDE.md",
      "CONTEXT.md",
      "CONTEXT-MAP.md",
      "DESIGN.md",
      ...maintainedDocs,
    ]) {
      const source = read(sourcePath);
      for (const match of source.matchAll(MARKDOWN_LINK_PATTERN)) {
        const target = localMarkdownTarget(sourcePath, match[1]);
        if (target) {
          expect(existsSync(target), `${sourcePath} -> ${match[1]}`).toBe(true);
        }
      }
    }
  });

  test("maps every bounded-context glossary without merging identities", () => {
    const contextMap = read("CONTEXT-MAP.md");
    for (const path of ["CONTEXT.md", "docs/sacred-bharat/CONTEXT.md"]) {
      expect(contextMap).toContain(`](${path})`);
    }
    expect(contextMap).toContain("Staff identity");
    expect(contextMap).toContain("Customer Account identity");
    expect(contextMap).toContain("Yatri identity");
  });

  test("keeps the role guide projected from executable policy", () => {
    const roleGuide = read("docs/PORTAL_ROLES_AND_ACCESS.md");
    const permissionsGuide = read("docs/PORTAL_PERMISSIONS_ARCHITECTURE.md");

    expect(ROLE_PERMISSIONS.Directors).toEqual(Object.values(PERMISSIONS));
    expect(ROLE_PERMISSIONS["Director Cement"]).toEqual(DIRECTOR_PERMISSIONS);
    expect(roleGuide).toContain("Directors receive every portal permission");
    expect(roleGuide).toContain("Director Cement uses the restricted director permission set");
    expect(roleGuide).toContain("convex/crm/lib/rolePolicy.ts");
    expect(permissionsGuide).toContain("Directors receive every portal permission");
    expect(roleGuide).not.toContain("Directors and Director Cement now share");
    expect(permissionsGuide).not.toContain("Directors` and `Director Cement` use");
  });

  test("protects current workflow terms and verification vocabulary", () => {
    const glossary = read("CONTEXT.md");
    const workflow = read("docs/PORTAL_CRM_WORKFLOWS.md");
    const verification = read("docs/VERIFICATION.md");
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

    expect(workflow).toContain("Proposal Doc");
    expect(workflow).toContain("`finalizedPdf` storage/API name remains only for compatibility");
    expect(workflow).toContain("linked Assigned Sales Rep");
    for (const term of [
      "**Query**:",
      "**Proposal**:",
      "**Sales Decision**:",
      "**Contracting Progress**:",
      "**Lead Stage**:",
      "**Proposal Doc**:",
    ]) {
      expect(glossary).toContain(term);
    }
    expect(glossary).toContain(
      "Proposal Pricing Complete means the Proposal is ready for Proposal Handoff to Sales"
    );
    expect(glossary).not.toContain("ready for Sales/client handoff and Job Card handoff");

    for (const script of ["check", "test", "test:e2e:smoke", "verify:local"]) {
      expect(packageJson.scripts[script]).toBeDefined();
      expect(verification).toContain(`bun run ${script}`);
    }
    expect(verification).toContain("Local release evidence");
    expect(verification).toContain("Authenticated production proof");
    for (const sourcePath of [
      "AGENTS.md",
      "README.md",
      "docs/BACKEND_INFRASTRUCTURE.md",
      "docs/E2E_TESTING.md",
      "docs/LOCAL_DEV.md",
      "docs/SPREADSHEET_OPERATIONS.md",
      "docs/VERIFICATION.md",
    ]) {
      expect(read(sourcePath), sourcePath).not.toContain("`bun test`");
    }
  });

  test("keeps the trust-boundary diagram editable, rendered, and linked", () => {
    const basename = "diagrams/citius-runtime-trust-boundaries";
    for (const extension of REQUIRED_DIAGRAM_EXTENSIONS) {
      expect(existsSync(resolve(ROOT, `${basename}${extension}`))).toBe(true);
    }
    const backend = read("docs/BACKEND_INFRASTRUCTURE.md");
    expect(backend).toContain("../diagrams/citius-runtime-trust-boundaries.svg");
    expect(backend).toContain("../diagrams/citius-runtime-trust-boundaries.mmd");
    expect(backend).toContain("../diagrams/citius-runtime-trust-boundaries.excalidraw");

    for (const path of [
      "convex/betterAuth/auth.ts",
      "convex/crm/commandReceipts.ts",
      "convex/crm/importActions.ts",
      "convex/crm/notificationEmailLedger.ts",
      "convex/crm/proposals.ts",
      "src/app/api/create-order/route.ts",
      "src/app/api/portal/exports/[operationId]/route.ts",
      "src/app/api/verify-payment/route.ts",
      "src/app/api/webhooks/razorpay/route.ts",
      "src/components/portal/PortalWorkspace.tsx",
      "src/components/portal/usePortalWorkspaceState.ts",
    ]) {
      expect(existsSync(resolve(ROOT, path)), path).toBe(true);
      expect(backend).toContain(path);
    }
  });

  test("keeps notification replay guidance editable, rendered, and linked", () => {
    const basename = "diagrams/notification-delivery-replay";
    for (const extension of REQUIRED_DIAGRAM_EXTENSIONS) {
      expect(existsSync(resolve(ROOT, `${basename}${extension}`))).toBe(true);
    }
    const deliveryGuide = read("docs/NOTIFICATION_EMAIL_DELIVERY.md");
    expect(deliveryGuide).toContain("../diagrams/notification-delivery-replay.svg");
    expect(deliveryGuide).toContain("diagrams/notification-delivery-replay.mmd");
    expect(deliveryGuide).toContain("Excalidraw scene");
  });

  test("keeps spreadsheet operations bounded, editable, rendered, and source-linked", () => {
    const operationBasenames = [
      "diagrams/passenger-import-operation",
      "diagrams/passenger-export-operation",
    ];
    for (const basename of operationBasenames) {
      for (const extension of REQUIRED_DIAGRAM_EXTENSIONS) {
        expect(existsSync(resolve(ROOT, `${basename}${extension}`))).toBe(true);
      }
      const mermaid = read(`${basename}.mmd`);
      const nodeCount = [...mermaid.matchAll(/\w+\["[^"]+"\]/g)].length;
      expect(nodeCount).toBeGreaterThanOrEqual(5);
      expect(nodeCount).toBeLessThanOrEqual(15);
    }

    const guide = read("docs/SPREADSHEET_OPERATIONS.md");
    for (const basename of operationBasenames) {
      const relativeBasename = `../${basename}`;
      expect(guide).toContain(`${relativeBasename}.svg`);
      expect(guide).toContain(`${relativeBasename}.mmd`);
      expect(guide).toContain(`${relativeBasename}.excalidraw`);
    }
    for (const contract of [
      "50-row requests",
      "There is no total workbook row cap",
      "At most three batch requests run concurrently",
      "15 minutes",
      "Retry the same operation and batch identity",
      "128 MiB worker RSS-growth budget",
    ]) {
      expect(guide).toContain(contract);
    }

    for (const sourcePath of [
      "convex/crm/importActions.ts",
      "convex/crm/imports.ts",
      "convex/crm/importWorkerPolicy.ts",
      "convex/crm/passengerExportPolicy.ts",
      "convex/crm/passengerExportWorker.ts",
      "src/app/api/portal/exports/[operationId]/route.ts",
      "src/components/portal/workspace/modals/PortalWorkspaceSpreadsheetModals.tsx",
    ]) {
      expect(existsSync(resolve(ROOT, sourcePath)), sourcePath).toBe(true);
      expect(guide).toContain(sourcePath);
    }

    for (const path of [
      "docs/README.md",
      "docs/PORTAL_CRM_WORKFLOWS.md",
      "docs/BACKEND_INFRASTRUCTURE.md",
      "docs/STAFF_WORKSPACE_PERFORMANCE.md",
    ]) {
      expect(read(path), path).toContain("SPREADSHEET_OPERATIONS.md");
    }
  });

  test("keeps protected deployment prose aligned with the machine contract", () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const releaseContract = JSON.parse(read("config/release/release-contract.json")) as {
      convexAwareBuildCommand: string;
    };
    const protectedDocs = [read("README.md"), read("RELEASE.md")];
    for (const source of protectedDocs) {
      expect(source).toContain(releaseContract.convexAwareBuildCommand);
    }
    expect(read("README.md")).not.toContain("bin/                   #");
  });

  test("keeps concrete backticked paths in current references resolvable", () => {
    const currentReferences = [
      "README.md",
      "RELEASE.md",
      "DESIGN.md",
      "docs/BACKEND_INFRASTRUCTURE.md",
      "docs/PORTAL_CRM_WORKFLOWS.md",
      "docs/PORTAL_PERMISSIONS_ARCHITECTURE.md",
      "docs/PORTAL_ROLES_AND_ACCESS.md",
      "docs/SPREADSHEET_OPERATIONS.md",
      "docs/VERIFICATION.md",
    ];
    const reviewedGeneratedExceptions = new Set([
      ".next/",
      "convex/_generated/",
      "convex/betterAuth/_generated/",
      "plans/",
    ]);

    for (const sourcePath of currentReferences) {
      for (const match of read(sourcePath).matchAll(BACKTICK_PATTERN)) {
        const token = match[1].replace(TRAILING_PATH_PUNCTUATION_PATTERN, "");
        if (
          token.includes(" ") ||
          token.startsWith("/") ||
          token.startsWith("@") ||
          !token.includes("/") ||
          PATH_EXCEPTION_PATTERN.test(token) ||
          !REPOSITORY_PATH_PATTERN.test(token) ||
          reviewedGeneratedExceptions.has(token)
        ) {
          continue;
        }
        expect(existsSync(resolve(ROOT, token)), `${sourcePath}: ${token}`).toBe(true);
      }
    }
  });

  test("separates canonical tickets, local evidence, and toolchain integration units", () => {
    const tracker = read("docs/agents/issue-tracker.md");
    const planMap = read("docs/PLAN_MAP.md");
    const release = read("RELEASE.md");

    expect(tracker).toContain("GitHub Issues are the canonical");
    expect(planMap).toContain("GitHub Issues");
    expect(planMap).toContain("Local briefs, evidence, handoffs, and working notes");
    expect(planMap).not.toContain("`.scratch/` issue tracker");
    expect(release).toContain("Agent-tool integration units");
    expect(release).toContain("explicit coupling note");
  });
});
