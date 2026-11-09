import { spawn } from "node:child_process";
import { fromPartial } from "@total-typescript/shoehorn";

/**
 * Runs a child process for a test without blocking the test thread.
 *
 * Do not use `spawnSync`/`execFileSync` in tests. On the Linux CI runner, Bun's synchronous spawn
 * occasionally never returns: Bun's 5-second test timeout fires, prints "killed 1 dangling
 * process", and the job then hangs until GitHub cancels it (seven Hosted Quality runs between
 * 2026-11-06 and 2026-11-08, each stuck inside a test's `spawnSync` of `bun` or `git`). A blocked
 * thread also ignores `spawnSync`'s own `timeout`. An awaited child keeps the event loop free, so
 * the child's `timeout` and the test timeout both work and a stuck child fails one test instead of
 * hanging the suite.
 */

/** Per-test timeout for tests that start child processes; longer than CHILD_TIMEOUT_MS. */
export const CHILD_TEST_TIMEOUT_MS = 30_000;

const CHILD_TIMEOUT_MS = 20_000;

export interface ChildResult {
  signal: string | null;
  status: number | null;
  stderr: string;
  stdout: string;
}

export interface ChildOptions {
  cwd?: string;
  /** Replaces the inherited environment when set, like `spawnSync`'s `env`. */
  env?: Record<string, string | undefined>;
  /** Written to the child's stdin, which is then closed. */
  input?: string;
  timeoutMs?: number;
}

export function runChild(
  command: string,
  args: readonly string[],
  { cwd, env, input, timeoutMs = CHILD_TIMEOUT_MS }: ChildOptions = {}
): Promise<ChildResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      // Next types NODE_ENV as required; a test may pass a deliberately minimal environment.
      env: env === undefined ? undefined : fromPartial<NodeJS.ProcessEnv>(env),
      killSignal: "SIGKILL",
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: timeoutMs,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", rejectPromise);
    child.once("close", (status, signal) => {
      resolvePromise({ signal, status, stderr, stdout });
    });
    child.stdin.end(input);
  });
}
