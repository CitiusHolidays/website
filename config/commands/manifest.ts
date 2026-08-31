import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatCliHelp, parseCliArguments } from "./cli";

export interface CommandManifestEntry {
  command: string;
  group: string;
  script: string;
}

export interface TaskCommandEntry {
  command: string;
  effects: string;
  profile: "full" | "portal" | "public" | "repository" | "studio" | "target-explicit";
  proof: string;
  scriptName: string;
  task: string;
}

export const TASK_COMMANDS: readonly TaskCommandEntry[] = [
  {
    command: "bun run repo:orient",
    effects: "Reads Git metadata and tracked owner documents; writes nothing",
    profile: "repository",
    proof: "Source orientation only; never deployment or release proof",
    scriptName: "repo:orient",
    task: "Orient to this checkout",
  },
  {
    command: "bun run dev:doctor -- --profile public",
    effects: "Reads local files, runtime versions, and key names; starts nothing",
    profile: "public",
    proof: "Local readiness only",
    scriptName: "dev:doctor",
    task: "Check public-site readiness",
  },
  {
    command: "bun run dev",
    effects: "Starts the local Next.js server and may write ignored .next artifacts",
    profile: "public",
    proof: "Development feedback only",
    scriptName: "dev",
    task: "Start the public site",
  },
  {
    command: "bun run dev:doctor -- --profile portal",
    effects: "Reads local files, runtime versions, key names, and development target identity",
    profile: "portal",
    proof: "Local readiness only",
    scriptName: "dev:doctor",
    task: "Check Staff Workspace readiness",
  },
  {
    command: "bun run dev:all",
    effects:
      "Starts Next.js, writes local build artifacts, and pushes/watches the selected development Convex target",
    profile: "portal",
    proof: "Development feedback only; never Preview or Production proof",
    scriptName: "dev:all",
    task: "Start the Staff Workspace stack",
  },
  {
    command: "bun run dev:doctor -- --profile studio",
    effects: "Reads local files and runtime versions; starts nothing",
    profile: "studio",
    proof: "Local readiness only",
    scriptName: "dev:doctor",
    task: "Check Studio readiness",
  },
  {
    command: "bun run dev:doctor -- --profile full",
    effects: "Reads every local profile prerequisite and development target identity",
    profile: "full",
    proof: "Local readiness only",
    scriptName: "dev:doctor",
    task: "Check the complete local stack",
  },
  {
    command: "bun run spec:check -- <exact-spec.md>",
    effects: "Reads one local file and repository paths; no network or writes",
    profile: "repository",
    proof: "Structural readiness only; not approval",
    scriptName: "spec:check",
    task: "Validate one local specification",
  },
  {
    command: "bun run spec:render-issue -- <exact-spec.md>",
    effects: "Reads one validated spec and writes deterministic Markdown to stdout only",
    profile: "repository",
    proof: "Issue-body draft only; does not publish or prove completion",
    scriptName: "spec:render-issue",
    task: "Render an approved specification for issue review",
  },
  {
    command: "bun run verify:local",
    effects: "Runs target-neutral local gates and may refresh ignored local evidence",
    profile: "full",
    proof: "Complete local evidence only; no hosted or target-bound proof",
    scriptName: "verify:local",
    task: "Collect complete local evidence",
  },
  {
    command: "bun run env:preflight -- --target <preview|production>",
    effects: "Reads the explicitly selected target configuration; performs no deployment",
    profile: "target-explicit",
    proof: "Configuration preflight only",
    scriptName: "env:preflight",
    task: "Inspect target configuration",
  },
] as const;

const GROUPS: ReadonlyArray<{ group: string; pattern: RegExp }> = [
  { group: "Local development", pattern: /^(?:dev|start)(?::|$)/ },
  { group: "Quality", pattern: /^(?:check|doctor|lint|test|typecheck|convex:typecheck)(?::|$)/ },
  {
    group: "Build and release",
    pattern: /^(?:assets|build|config|convex:codegen|diff|env|performance|verify)(?::|$)/,
  },
  { group: "Operations", pattern: /^(?:ai|auth|automation|convex:dev|smoke)(?::|$)/ },
];

const COMMAND_MANIFEST_CLI = {
  command: "bun run help --",
  description:
    "List reviewed package commands. Discovery reads package.json only and never runs a command.",
  options: [
    {
      description: "Emit stable machine-readable output",
      name: "json",
      type: "boolean" as const,
    },
    {
      description: "Show only the reviewed task-first command catalogue",
      name: "tasks",
      type: "boolean" as const,
    },
  ],
};

function commandGroup(name: string) {
  return GROUPS.find(({ pattern }) => pattern.test(name))?.group ?? "Maintenance";
}

export function createCommandManifest(scripts: Record<string, string>): CommandManifestEntry[] {
  return Object.entries(scripts)
    .map(([name, script]) => ({
      command: `bun run ${name}`,
      group: commandGroup(name),
      script,
    }))
    .sort((left, right) => left.command.localeCompare(right.command));
}

export function createTaskCommandCatalog(scripts: Record<string, string>) {
  const missing = TASK_COMMANDS.filter(({ scriptName }) => !scripts[scriptName]).map(
    ({ scriptName }) => scriptName
  );
  if (missing.length > 0) {
    throw new Error(
      `Task command catalogue references missing package scripts: ${missing.join(", ")}`
    );
  }
  return [...TASK_COMMANDS];
}

function formatTaskCommands(entries: readonly TaskCommandEntry[]) {
  return [
    "Task-first commands (review effects and proof scope before running)",
    ...entries.flatMap((entry) => [
      "",
      `${entry.task}:`,
      `  ${entry.command}`,
      `  profile: ${entry.profile}`,
      `  effects: ${entry.effects}`,
      `  proof: ${entry.proof}`,
    ]),
  ].join("\n");
}

function formatManifest(
  entries: readonly CommandManifestEntry[],
  tasks: readonly TaskCommandEntry[]
) {
  const lines = [
    formatTaskCommands(tasks),
    "",
    "Repository commands (derived from package.json; listing is side-effect-free)",
    "Use `<command> -- --help` for first-party TypeScript command options.",
  ];
  for (const { group } of GROUPS) {
    const commands = entries.filter((entry) => entry.group === group);
    if (commands.length === 0) {
      continue;
    }
    lines.push("", `${group}:`, ...commands.map((entry) => `  ${entry.command}`));
  }
  const maintenance = entries.filter((entry) => entry.group === "Maintenance");
  if (maintenance.length > 0) {
    lines.push("", "Maintenance:", ...maintenance.map((entry) => `  ${entry.command}`));
  }
  return lines.join("\n");
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), COMMAND_MANIFEST_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(COMMAND_MANIFEST_CLI));
    } else {
      const root = resolve(import.meta.dir, "../..");
      // SAFETY: only the scripts dictionary declared here is read from the repository-owned package.json.
      const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
        scripts: Record<string, string>;
      };
      const manifest = createCommandManifest(packageJson.scripts);
      const tasks = createTaskCommandCatalog(packageJson.scripts);
      const selected = parsed.values.tasks ? tasks : manifest;
      let output = formatManifest(manifest, tasks);
      if (parsed.values.json) {
        output = JSON.stringify(selected, null, 2);
      } else if (parsed.values.tasks) {
        output = formatTaskCommands(tasks);
      }
      console.log(output);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Command discovery failed");
    process.exitCode = 1;
  }
}
