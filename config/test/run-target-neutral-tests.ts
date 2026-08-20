import { spawnSync } from "node:child_process";

const CONVEX_INTEGRATION_PATTERN = /\.convex\.integration\.[cm]?[jt]sx?$/;

export function classifyTargetNeutralTestArgs(args: string[]) {
  const convexArgs = args.filter((arg) => CONVEX_INTEGRATION_PATTERN.test(arg));
  const otherArgs = args.filter((arg) => !CONVEX_INTEGRATION_PATTERN.test(arg));
  if (convexArgs.length > 0 && otherArgs.length > 0) {
    throw new Error(
      "Focused test arguments must select either Bun tests or Convex integration tests, not both"
    );
  }
  if (convexArgs.length > 0) {
    return { bun: false, convex: true } as const;
  }
  if (otherArgs.length > 0) {
    return { bun: true, convex: false } as const;
  }
  return { bun: true, convex: true } as const;
}

function run(command: string, args: string[]) {
  return (
    spawnSync(command, args, {
      cwd: process.cwd(),
      stdio: "inherit",
    }).status ?? 1
  );
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    const lanes = classifyTargetNeutralTestArgs(args);
    if (lanes.bun) {
      const status = run("bun", [
        "test",
        "--isolate",
        "--max-concurrency=1",
        "--path-ignore-patterns=e2e/specs/**",
        "--path-ignore-patterns=e2e/public/**",
        ...args,
      ]);
      if (status !== 0) {
        process.exit(status);
      }
    }
    if (lanes.convex) {
      const status = run("bunx", [
        "--no-install",
        "vitest",
        "run",
        "--config",
        "vitest.convex.config.mts",
        ...args,
      ]);
      if (status !== 0) {
        process.exit(status);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Target-neutral test runner failed");
    process.exitCode = 1;
  }
}
