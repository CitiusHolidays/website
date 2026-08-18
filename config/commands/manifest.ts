import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatCliHelp, parseCliArguments } from "./cli";

export interface CommandManifestEntry {
  command: string;
  group: string;
  script: string;
}

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

function formatManifest(entries: readonly CommandManifestEntry[]) {
  const lines = [
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
      console.log(
        parsed.values.json ? JSON.stringify(manifest, null, 2) : formatManifest(manifest)
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Command discovery failed");
    process.exitCode = 1;
  }
}
