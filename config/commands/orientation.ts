import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatCliHelp, parseCliArguments } from "./cli";
import { createTaskCommandCatalog } from "./manifest";

export interface RevisionState {
  branch: string;
  revision: string;
  trackedDirty: boolean;
}

interface OwnedReferenceRule {
  forbidden?: readonly string[];
  path: string;
  required: readonly string[];
}

interface OwnershipInputs {
  files: Readonly<Record<string, string>>;
  scripts: Record<string, string>;
}

export const OWNED_REFERENCE_RULES: readonly OwnedReferenceRule[] = [
  {
    forbidden: ["`bun run lint` then `bun run lint:ratchet`"],
    path: "AGENTS.md",
    required: ["`bun run help`", "`bun run verify:local`"],
  },
  {
    forbidden: ["The current `main` checkpoint is"],
    path: "RELEASE.md",
    required: ["`bun run repo:orient`", "not deployment or Production proof"],
  },
  {
    path: "README.md",
    required: [
      "issuer-qualified",
      "exactly one active `staffUsers` record",
      "`bun run repo:orient`",
    ],
  },
  {
    path: "docs/BACKEND_INFRASTRUCTURE.md",
    required: [
      "issuer-qualified",
      "exactly one active `staffUsers` record",
      "Email matching alone never grants Staff authority",
      "adr/0009-auth-token-identity-migration.md",
    ],
  },
  {
    path: "docs/LOCAL_DEV.md",
    required: [
      "`public` → `bun run dev`",
      "`portal` → `bun run dev:all`",
      "`studio` → `bun run --cwd citius-blog dev`",
      "`full` → start both",
    ],
  },
  {
    path: "docs/agents/issue-tracker.md",
    required: ["`bun run spec:render-issue -- <exact-spec.md>`", "standard output only"],
  },
  {
    path: "docs/agents/spec-handoff.md",
    required: ["`bun run spec:render-issue -- <exact-spec.md>`", "does not publish"],
  },
  {
    path: "docs/agents/change-program-brief.md",
    required: [
      "docs/agents/templates/spec.md",
      "Unpublished: pending publication authority",
      "must not become a second live tracker",
    ],
  },
] as const;

const ORIENTATION_CLI = {
  command: "bun run repo:orient --",
  description:
    "Report the source revision and validate ownership-critical references. Reads tracked source and Git metadata only.",
  options: [
    {
      description: "Validate owner contracts without printing revision orientation",
      name: "check",
      type: "boolean" as const,
    },
    {
      description: "Emit stable machine-readable orientation",
      name: "json",
      type: "boolean" as const,
    },
  ],
};

export function validateOwnershipContracts({ files, scripts }: OwnershipInputs) {
  const errors: string[] = [];
  try {
    createTaskCommandCatalog(scripts);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Task command catalogue is invalid");
  }
  for (const rule of OWNED_REFERENCE_RULES) {
    const source = files[rule.path];
    if (source === undefined) {
      errors.push(`Missing ownership-critical document: ${rule.path}`);
      continue;
    }
    for (const required of rule.required) {
      if (!source.includes(required)) {
        errors.push(`${rule.path} is missing required owner reference: ${required}`);
      }
    }
    for (const forbidden of rule.forbidden ?? []) {
      if (source.includes(forbidden)) {
        errors.push(`${rule.path} retains superseded owner reference: ${forbidden}`);
      }
    }
  }
  return errors;
}

export function formatRevisionOrientation(state: RevisionState) {
  return [
    "Repository revision orientation (source-derived; read-only)",
    `Revision: ${state.revision}`,
    `Branch: ${state.branch || "detached HEAD"}`,
    `Tracked working tree: ${state.trackedDirty ? "dirty" : "clean"}`,
    "Owner contracts: passed",
    "Commands: package.json via `bun run help`",
    "Contexts: CONTEXT-MAP.md and docs/agents/task-routing.md",
    "Specifications: GitHub Issues are canonical; .scratch is evidence only",
    "Proof boundary: this orientation and any generated documentation are not deployment or Production proof.",
  ].join("\n");
}

function readOwnershipInputs(root: string): OwnershipInputs {
  const files = Object.fromEntries(
    OWNED_REFERENCE_RULES.map(({ path }) => [path, readFileSync(resolve(root, path), "utf8")])
  );
  // SAFETY: this local boundary reads only the repository-owned package scripts dictionary.
  const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  return { files, scripts: packageJson.scripts };
}

function gitOutput(root: string, args: readonly string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Git command failed: git ${args.join(" ")}`);
  }
  return result.stdout.trim();
}

function readRevisionState(root: string): RevisionState {
  return {
    branch: gitOutput(root, ["branch", "--show-current"]),
    revision: gitOutput(root, ["rev-parse", "HEAD"]),
    trackedDirty: Boolean(gitOutput(root, ["status", "--porcelain", "--untracked-files=no"])),
  };
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), ORIENTATION_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(ORIENTATION_CLI));
    } else {
      const root = resolve(import.meta.dir, "../..");
      const errors = validateOwnershipContracts(readOwnershipInputs(root));
      if (errors.length > 0) {
        throw new Error(errors.join("\n"));
      }
      if (parsed.values.check) {
        console.log("repo:orient: ownership-critical references passed");
      } else {
        const state = readRevisionState(root);
        console.log(
          parsed.values.json
            ? JSON.stringify({ ...state, ownershipContracts: "passed" }, null, 2)
            : formatRevisionOrientation(state)
        );
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Repository orientation failed");
    process.exitCode = 1;
  }
}
