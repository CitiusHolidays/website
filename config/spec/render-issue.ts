import { resolve } from "node:path";
import { formatCliHelp, parseCliArguments } from "../commands/cli";
import { checkSpecPathArguments, parseSpecDocument } from "./spec-check";

const LEVEL_TWO_HEADING = /^##\s+/;
const LEVEL_TWO_HEADING_CAPTURE = /^##\s+(.+?)\s*$/;
const DOCUMENT_TITLE = /^#\s+\S/;
const DOCUMENT_TITLE_PREFIX = /^#\s+/;

const RENDER_ISSUE_CLI = {
  allowPositionals: true,
  command: "bun run spec:render-issue -- <exact-spec.md>",
  description:
    "Render exactly one valid, implementation-authorized local spec as deterministic GitHub Markdown on stdout. Performs no network or write action.",
  options: [],
} as const;

interface IssueBodyField {
  outputHeading: string;
  sourceHeadings: readonly string[];
}

const ISSUE_BODY_FIELDS: readonly IssueBodyField[] = [
  { outputHeading: "Context and target user/job", sourceHeadings: ["Target user and job"] },
  { outputHeading: "Verified current state", sourceHeadings: ["Verified current state"] },
  { outputHeading: "Proposed behavior", sourceHeadings: ["Desired behavior"] },
  {
    outputHeading: "Why now and observable completion",
    sourceHeadings: ["Why now", "Observable completion"],
  },
  { outputHeading: "Scope, files, and surfaces", sourceHeadings: ["Scope"] },
  {
    outputHeading: "Preservation constraints and out of scope",
    sourceHeadings: ["Preservation constraints"],
  },
  { outputHeading: "Dependencies", sourceHeadings: ["Dependencies"] },
  {
    outputHeading: "Failure modes and rollback",
    sourceHeadings: ["Failure modes and rollback"],
  },
  { outputHeading: "Acceptance criteria", sourceHeadings: ["Acceptance criteria"] },
  { outputHeading: "Testing and evidence", sourceHeadings: ["Proof boundaries"] },
  { outputHeading: "UI extension", sourceHeadings: ["UI extension"] },
] as const;

const MAPPED_SOURCE_HEADINGS = new Set(
  [
    ...ISSUE_BODY_FIELDS.flatMap(({ sourceHeadings }) => sourceHeadings),
    "Repository references",
  ].map((heading) => heading.toLowerCase())
);

function sectionBody(source: string, heading: string) {
  const lines = source.split("\n");
  const headingIndex = lines.findIndex(
    (line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase()
  );
  const trailing = lines.slice(headingIndex + 1);
  const nextHeadingIndex = trailing.findIndex((line) => LEVEL_TWO_HEADING.test(line));
  return trailing
    .slice(0, nextHeadingIndex < 0 ? undefined : nextHeadingIndex)
    .join("\n")
    .trim();
}

function documentTitle(source: string) {
  const title = source
    .split("\n")
    .find((line) => DOCUMENT_TITLE.test(line))
    ?.replace(DOCUMENT_TITLE_PREFIX, "")
    .trim();
  if (!title) {
    throw new Error("Validated implementation spec is missing its title");
  }
  return title;
}

function additionalSections(source: string) {
  const lines = source.split("\n");
  const sections: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index]?.match(LEVEL_TWO_HEADING_CAPTURE)?.[1]?.trim();
    if (!(heading && !MAPPED_SOURCE_HEADINGS.has(heading.toLowerCase()))) {
      continue;
    }
    const trailing = lines.slice(index + 1);
    const nextHeadingIndex = trailing.findIndex((line) => LEVEL_TWO_HEADING.test(line));
    const content = trailing
      .slice(0, nextHeadingIndex < 0 ? undefined : nextHeadingIndex)
      .join("\n")
      .trim();
    sections.push(`## ${heading}\n\n${content}`);
  }
  return sections;
}

export function renderGitHubIssueBody(source: string) {
  const parsed = parseSpecDocument(source);
  const sections = ISSUE_BODY_FIELDS.map(({ outputHeading, sourceHeadings }) => {
    const contents = sourceHeadings.map((heading) => sectionBody(parsed.body, heading));
    const content =
      contents.length === 1
        ? contents[0]
        : contents.map((value, index) => `### ${sourceHeadings[index]}\n\n${value}`).join("\n\n");
    return `## ${outputHeading}\n\n${content}`;
  });
  sections.push(...additionalSections(parsed.body));
  sections.push(
    [
      "## Related issues and durable decisions",
      "",
      `Source artifact kind: ${parsed.metadata.artifact_kind}`,
      `Implementation authorized at render: ${parsed.metadata.implementation_authorized}`,
      `Source issue: ${parsed.metadata.source_issue}`,
      `Verified source revision: \`${parsed.metadata.verified_revision}\``,
      `Source readiness at render: ${parsed.metadata.readiness}`,
      "",
      "Repository references:",
      sectionBody(parsed.body, "Repository references"),
    ].join("\n")
  );
  return [
    `<!-- Suggested issue title: ${documentTitle(parsed.body)} -->`,
    "<!-- Rendered locally from a validated implementation spec; review and deduplicate before any separately authorized GitHub write. -->",
    "",
    ...sections.flatMap((section, index) => (index === 0 ? [section] : ["", section])),
    "",
  ].join("\n");
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), RENDER_ISSUE_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(RENDER_ISSUE_CLI));
    } else {
      const root = resolve(import.meta.dir, "../..");
      const checked = checkSpecPathArguments(parsed.positionals, root, "spec:render-issue");
      if (!(checked.result?.valid && checked.result.executable && checked.source)) {
        const errors =
          checked.errors.length > 0
            ? checked.errors
            : ["Issue rendering requires one valid, implementation-authorized implementation_spec"];
        for (const error of errors) {
          console.error(`spec:render-issue: ${error}`);
        }
        process.exitCode = 1;
      } else if (checked.result.artifactKind === "implementation_spec") {
        process.stdout.write(renderGitHubIssueBody(checked.source));
      } else {
        console.error("spec:render-issue: Only implementation_spec artifacts can be rendered");
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Issue rendering failed");
    process.exitCode = 1;
  }
}
