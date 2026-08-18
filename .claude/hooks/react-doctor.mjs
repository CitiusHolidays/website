import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SPAWN_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const EDIT_TOOL_NAMES = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit", "ApplyPatch"]);

const readFileOrEmpty = (source) => {
  try {
    return readFileSync(source, "utf8");
  } catch {
    return "";
  }
};

export const shouldScan = (input) => {
  const eventName = input.hook_event_name || input.eventName || input.event_name;
  if (eventName === "PostToolBatch") {
    const toolCalls = Array.isArray(input.tool_calls) ? input.tool_calls : [];
    return toolCalls.some((toolCall) => EDIT_TOOL_NAMES.has(toolCall.tool_name));
  }
  const toolName = input.tool_name || input.toolName || input.tool;
  return !toolName || EDIT_TOOL_NAMES.has(toolName);
};

export const runReactDoctor = (projectRoot) => {
  const entry = join(projectRoot, "node_modules", "react-doctor", "bin", "react-doctor.js");
  if (!existsSync(entry)) {
    return {
      kind: "missing",
      output:
        "React Doctor is not installed from the reviewed lockfile. Run `bun install --frozen-lockfile`; the hook will not download or execute a fallback.",
    };
  }

  const result = spawnSync(
    process.execPath,
    [entry, "--verbose", "--scope", "changed", "--blocking", "warning", "--no-score"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: SPAWN_MAX_BUFFER_BYTES,
      shell: false,
    }
  );
  return {
    kind: "ran",
    output: `${result.stdout || ""}${result.stderr || ""}`.trim(),
    status: result.status ?? 1,
  };
};

function emitContext(input, message) {
  if (input.hook_event_name === "PostToolBatch") {
    console.log(
      JSON.stringify({
        hookSpecificOutput: { additionalContext: message, hookEventName: "PostToolBatch" },
      })
    );
  } else {
    console.log(JSON.stringify({ additional_context: message }));
  }
}

export const main = () => {
  let input;
  try {
    input = JSON.parse(readFileOrEmpty(0) || "{}");
  } catch {
    input = {};
  }

  if (!shouldScan(input)) {
    return;
  }

  const projectRoot = process.env.CLAUDE_PROJECT_DIR || join(__dirname, "../..");
  const scan = runReactDoctor(projectRoot);
  if (scan.kind === "missing") {
    emitContext(input, scan.output);
    return;
  }
  if (scan.status === 0) {
    return;
  }

  emitContext(
    input,
    `React Doctor found issues in the changed files. Review and fix regressions before finishing. For a confirmed issue that cannot be fixed now, record the rule, file/line, confidence, impact, and proposed fix.\n\n${scan.output || `React Doctor exited ${scan.status} without diagnostic output.`}`
  );
};

if (process.argv[1] && __filename === resolve(process.argv[1])) {
  main();
}
