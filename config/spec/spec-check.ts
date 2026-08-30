import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { formatCliHelp, parseCliArguments } from "../commands/cli";

export const ARTIFACT_KINDS = ["research", "decision_handoff", "implementation_spec"] as const;
export const SPEC_READINESS_VALUES = [
  "discovery",
  "needs_decision",
  "draft",
  "approved",
  "ticketed",
  "completed",
  "superseded",
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export type Readiness = (typeof SPEC_READINESS_VALUES)[number];

export interface SpecMetadata {
  artifact_kind?: string;
  implementation_authorized?: string;
  readiness?: string;
  source_issue?: string;
  verified_revision?: string;
}

export interface SpecCheckResult {
  artifactKind: ArtifactKind | null;
  errors: string[];
  executable: boolean;
  readiness: Readiness | null;
  valid: boolean;
}

const REQUIRED_METADATA = [
  "artifact_kind",
  "readiness",
  "implementation_authorized",
  "source_issue",
  "verified_revision",
] as const;
const REQUIRED_SECTIONS = {
  decision_handoff: [
    "Decision needed",
    "Options",
    "Recommendation",
    "Repository references",
    "Evidence boundaries",
  ],
  implementation_spec: [
    "Target user and job",
    "Verified current state",
    "Desired behavior",
    "Why now",
    "Observable completion",
    "Scope",
    "Preservation constraints",
    "Dependencies",
    "Failure modes and rollback",
    "Repository references",
    "Acceptance criteria",
    "Proof boundaries",
    "UI extension",
  ],
  research: ["Question", "Findings", "Repository references", "Evidence boundaries"],
} satisfies Record<ArtifactKind, string[]>;
const UNRESOLVED_PLACEHOLDER =
  /\b(?:FIXME|TBD|TODO|XXX)\b|\?\?\?|\{\{[^}]+\}\}|<\s*(?:fill|insert|replace)[^>]*>/i;
const OBSERVABLE_ACCEPTANCE =
  /\b(?:at least|contains?|displays?|exits?|passes?|rejects?|returns?|shows?|within|zero)\b|\d/i;
const QUOTED_SCALAR = /^(?:"(.*)"|'(.*)')$/;
const DOCUMENT_TITLE = /^#\s+\S/m;
const LEVEL_TWO_HEADING = /^##\s+/;
const LEVEL_TWO_OR_THREE_HEADING = /^#{2,3}\s+/;
const BACKTICK_PATH = /`([^`]+)`/g;
const DEPENDENCY_REFERENCE =
  /(?:#[1-9]\d*|https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/issues\/[1-9]\d*)/i;
const NO_DEPENDENCY_REASON = /^None:\s*\S/i;
const ACCEPTANCE_CHECKBOX = /^- \[[ x]\]\s+\S/i;
const NON_TICKET_SOURCE = /^(?:none|n\/a)(?::|$)/i;
const VALID_SOURCE_ISSUE =
  /^(?:#[1-9]\d*|https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/issues\/[1-9]\d*|none:\s*\S.*)$/i;
const VALID_REVISION = /^(?:[0-9a-f]{7,40}|working-tree:[0-9a-f]{7,40})$/i;
const UI_EXTENSION_REFERENCE = /`docs\/agents\/ui-change-brief\.md`|^N\/A:\s*\S|^###\s+\S/im;
const VAGUE_ACCEPTANCE =
  /^- \[[ x]\]\s+(?:it|the (?:change|feature|implementation))\s+(?:works|is (?:complete|correct|done))\.?$/i;

const SPEC_CHECK_CLI = {
  allowPositionals: true,
  command: "bun run spec:check -- <exact-spec.md>",
  description:
    "Validate exactly one local specification. Reads one file and repository references only; performs no network or write action.",
  options: [],
} as const;

function isSpecMetadataKey(key: string): key is keyof SpecMetadata {
  return REQUIRED_METADATA.some((field) => field === key);
}

export function parseSpecDocument(source: string) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  if (lines[0]?.trim() !== "---") {
    return { body: source, errors: ["Missing YAML frontmatter"], metadata: {} };
  }
  const closingIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (closingIndex < 0) {
    return {
      body: source,
      errors: ["Frontmatter is missing its closing ---"],
      metadata: {},
    };
  }
  const metadata: SpecMetadata = {};
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const line of lines.slice(1, closingIndex + 1)) {
    if (!line.trim() || line.trimStart().startsWith("#")) {
      continue;
    }
    const separator = line.indexOf(":");
    if (separator < 1) {
      errors.push(`Malformed frontmatter line: ${line.trim()}`);
      continue;
    }
    const key = line.slice(0, separator).trim();
    if (!isSpecMetadataKey(key)) {
      errors.push(`Unknown frontmatter field: ${key}`);
      continue;
    }
    if (seen.has(key)) {
      errors.push(`Duplicate frontmatter field: ${key}`);
      continue;
    }
    seen.add(key);
    const rawValue = line.slice(separator + 1).trim();
    metadata[key] = rawValue.replace(QUOTED_SCALAR, "$1$2");
  }
  return {
    body: lines.slice(closingIndex + 2).join("\n"),
    errors,
    metadata,
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sectionBody(source: string, heading: string) {
  const lines = source.split("\n");
  const headingIndex = lines.findIndex(
    (line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase()
  );
  if (headingIndex < 0) {
    return null;
  }
  const trailingLines = lines.slice(headingIndex + 1);
  const nextHeadingIndex = trailingLines.findIndex((line) => LEVEL_TWO_HEADING.test(line));
  return trailingLines
    .slice(0, nextHeadingIndex < 0 ? undefined : nextHeadingIndex)
    .join("\n")
    .trim();
}

function sectionCount(source: string, heading: string) {
  return [...source.matchAll(new RegExp(`^##\\s+${escapeRegex(heading)}\\s*$`, "gim"))].length;
}

function subsectionBody(source: string, heading: string) {
  const lines = source.split("\n");
  const headingIndex = lines.findIndex(
    (line) => line.trim().toLowerCase() === `### ${heading}`.toLowerCase()
  );
  if (headingIndex < 0) {
    return null;
  }
  const trailingLines = lines.slice(headingIndex + 1);
  const nextHeadingIndex = trailingLines.findIndex((line) => LEVEL_TWO_OR_THREE_HEADING.test(line));
  return trailingLines
    .slice(0, nextHeadingIndex < 0 ? undefined : nextHeadingIndex)
    .join("\n")
    .trim();
}

function referencedPaths(section: string) {
  return [...section.matchAll(BACKTICK_PATH)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function isInsideRoot(path: string, root: string) {
  const fromRoot = relative(root, path);
  return fromRoot === "" || !(fromRoot.startsWith("..") || isAbsolute(fromRoot));
}

function validateRepositoryReferences(section: string | null, root: string, errors: string[]) {
  if (!section) {
    return;
  }
  const paths = referencedPaths(section);
  if (paths.length === 0) {
    errors.push("Repository references must include at least one backticked path");
    return;
  }
  for (const path of paths) {
    const absolutePath = resolve(root, path);
    if (!(isInsideRoot(absolutePath, root) && existsSync(absolutePath))) {
      errors.push(`Broken or out-of-repository reference: ${path}`);
    }
  }
}

function validateImplementationSections(body: string, authorized: boolean, errors: string[]) {
  const dependencies = sectionBody(body, "Dependencies");
  if (dependencies) {
    const lines = dependencies
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 1 && NO_DEPENDENCY_REASON.test(lines[0] ?? "")) {
      // An explicit no-dependency reason is complete on its own.
    } else if (lines.some((line) => !(line.startsWith("-") && DEPENDENCY_REFERENCE.test(line)))) {
      errors.push(
        "Each dependency must be a bullet with a GitHub issue reference, or one None: reason"
      );
    }
  }
  const proof = sectionBody(body, "Proof boundaries");
  for (const proofScope of ["Local/source proof", "Preview proof", "Production proof"]) {
    if (!(proof && new RegExp(`^###\\s+${escapeRegex(proofScope)}\\s*$`, "im").test(proof))) {
      errors.push(`Proof boundaries is missing ${proofScope}`);
    } else if (!subsectionBody(proof, proofScope)) {
      errors.push(`Proof boundary is empty: ${proofScope}`);
    }
  }
  const uiExtension = sectionBody(body, "UI extension");
  if (uiExtension && !UI_EXTENSION_REFERENCE.test(uiExtension)) {
    errors.push(
      "UI extension must provide structured answers, reference `docs/agents/ui-change-brief.md`, or state N/A: with a reason"
    );
  }
  if (!authorized) {
    return;
  }
  const acceptance = sectionBody(body, "Acceptance criteria") ?? "";
  const criteria = acceptance
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => ACCEPTANCE_CHECKBOX.test(line));
  if (criteria.length === 0) {
    errors.push("Authorized implementation specs require checklist acceptance criteria");
  } else if (!criteria.some((criterion) => OBSERVABLE_ACCEPTANCE.test(criterion))) {
    errors.push("Authorized acceptance criteria need at least one measurable observable outcome");
  } else if (criteria.some((criterion) => VAGUE_ACCEPTANCE.test(criterion))) {
    errors.push(
      "Acceptance criteria must name an observable result, not only say that work is done"
    );
  }
}

function classifyMetadata(metadata: SpecMetadata, errors: string[]) {
  for (const field of REQUIRED_METADATA) {
    if (!metadata[field]?.trim()) {
      errors.push(`Missing frontmatter field: ${field}`);
    }
  }
  const artifactKind = ARTIFACT_KINDS.find((kind) => kind === metadata.artifact_kind) ?? null;
  const readiness = SPEC_READINESS_VALUES.find((value) => value === metadata.readiness) ?? null;
  if (metadata.artifact_kind && !artifactKind) {
    errors.push(`Unknown artifact_kind: ${metadata.artifact_kind}`);
  }
  if (metadata.readiness && !readiness) {
    errors.push(`Unknown readiness: ${metadata.readiness}`);
  }
  return { artifactKind, readiness };
}

function validateAuthorization(
  metadata: SpecMetadata,
  artifactKind: ArtifactKind | null,
  readiness: Readiness | null,
  errors: string[]
) {
  const authorizationValue = metadata.implementation_authorized;
  if (authorizationValue !== "true" && authorizationValue !== "false") {
    errors.push("implementation_authorized must be true or false");
  }
  const authorized = authorizationValue === "true";
  if (authorized && artifactKind !== "implementation_spec") {
    errors.push("Only implementation_spec artifacts may authorize implementation");
  }
  if (authorized && readiness !== "approved" && readiness !== "ticketed") {
    errors.push("Authorized implementation specs must be approved or ticketed");
  }
  if (authorized && NON_TICKET_SOURCE.test(metadata.source_issue ?? "")) {
    errors.push("Authorized implementation specs require a source issue");
  }
  if (readiness === "ticketed" && NON_TICKET_SOURCE.test(metadata.source_issue ?? "")) {
    errors.push("Ticketed specs require a canonical source issue");
  }
  if ((readiness === "completed" || readiness === "superseded") && authorized) {
    errors.push(`${readiness} artifacts cannot retain implementation authorization`);
  }
  return authorized;
}

function validateSourceMetadata(metadata: SpecMetadata, errors: string[]) {
  if (metadata.source_issue && !VALID_SOURCE_ISSUE.test(metadata.source_issue)) {
    errors.push("source_issue must be #number, a GitHub URL, or None: with a reason");
  }
  if (metadata.verified_revision && !VALID_REVISION.test(metadata.verified_revision)) {
    errors.push("verified_revision must be a commit SHA or working-tree:<base SHA>");
  }
}

function validateRequiredSections(
  body: string,
  artifactKind: ArtifactKind,
  root: string,
  authorized: boolean,
  errors: string[]
) {
  if (!DOCUMENT_TITLE.test(body)) {
    errors.push("Missing specification title");
  }
  for (const heading of REQUIRED_SECTIONS[artifactKind]) {
    if (sectionCount(body, heading) > 1) {
      errors.push(`Duplicate required section: ${heading}`);
    }
    const content = sectionBody(body, heading);
    if (!content) {
      errors.push(`Missing or empty required section: ${heading}`);
    }
  }
  validateRepositoryReferences(sectionBody(body, "Repository references"), root, errors);
  if (artifactKind === "implementation_spec") {
    validateImplementationSections(body, authorized, errors);
  }
}

export function validateSpecDocument(source: string, root = process.cwd()): SpecCheckResult {
  const parsed = parseSpecDocument(source);
  const errors = [...parsed.errors];
  const { artifactKind, readiness } = classifyMetadata(parsed.metadata, errors);
  const authorized = validateAuthorization(parsed.metadata, artifactKind, readiness, errors);
  validateSourceMetadata(parsed.metadata, errors);
  if (UNRESOLVED_PLACEHOLDER.test(source)) {
    errors.push("Unresolved placeholder marker found");
  }
  if (artifactKind) {
    validateRequiredSections(parsed.body, artifactKind, root, authorized, errors);
  }
  return {
    artifactKind,
    errors,
    executable: errors.length === 0 && authorized,
    readiness,
    valid: errors.length === 0,
  };
}

export function checkSpecPathArguments(
  args: string[],
  root = process.cwd(),
  command = "spec:check"
) {
  const paths = args.filter((arg) => arg !== "--");
  if (paths.length !== 1) {
    return {
      errors: [`Usage: bun run ${command} -- <exact-path-to-one-spec.md>`],
      result: null,
      source: null,
    };
  }
  const [requestedPath] = paths;
  if (!requestedPath) {
    return { errors: ["Spec path is required"], result: null, source: null };
  }
  const path = resolve(root, requestedPath);
  if (!(existsSync(path) && statSync(path).isFile())) {
    return {
      errors: [`Spec path is not a file: ${paths[0]}`],
      result: null,
      source: null,
    };
  }
  const source = readFileSync(path, "utf8");
  const result = validateSpecDocument(source, root);
  return { errors: result.errors, result, source };
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), SPEC_CHECK_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(SPEC_CHECK_CLI));
    } else {
      const checked = checkSpecPathArguments(parsed.positionals);
      if (checked.result?.valid) {
        const state = checked.result.executable ? "executable" : "not implementation-authorized";
        console.log(
          `spec:check: valid ${checked.result.artifactKind} (${checked.result.readiness}; ${state})`
        );
      } else {
        for (const error of checked.errors) {
          console.error(`spec:check: ${error}`);
        }
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Specification check failed");
    process.exitCode = 1;
  }
}
