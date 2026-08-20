import { spawnSync } from "node:child_process";

interface DeploymentCommand {
  args: string[];
  executable: string;
  stdin?: string;
}

const GIT_REVISION = /^[a-f0-9]{40}$/;
const deployCommand: DeploymentCommand = {
  args: ["convex", "deploy", "--cmd", "bun run build"],
  executable: "bunx",
};

export function createVercelConvexDeploymentPlan(
  env: Record<string, string | undefined>
): DeploymentCommand[] {
  if (!(env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "production")) {
    throw new Error("VERCEL_ENV must be preview or production");
  }
  if (env.VERCEL_ENV === "preview") {
    return [deployCommand];
  }
  const sourceRevision = env.VERCEL_GIT_COMMIT_SHA;
  if (!(sourceRevision && GIT_REVISION.test(sourceRevision))) {
    throw new Error("VERCEL_GIT_COMMIT_SHA must be an exact 40-character lowercase Git revision");
  }
  return [
    deployCommand,
    {
      args: ["convex", "env", "set", "--force"],
      executable: "bunx",
      stdin: `OPERATIONAL_CONTROL_SOURCE_REVISION=${sourceRevision}\nVERCEL_ENV=production\n`,
    },
  ];
}

function run(command: DeploymentCommand) {
  const result = command.stdin
    ? spawnSync(command.executable, command.args, {
        env: process.env,
        input: command.stdin,
        stdio: ["pipe", "inherit", "inherit"],
      })
    : spawnSync(command.executable, command.args, {
        env: process.env,
        stdio: "inherit",
      });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${command.executable} ${command.args.join(" ")} failed with exit code ${result.status ?? 1}`
    );
  }
}

if (import.meta.main) {
  try {
    for (const command of createVercelConvexDeploymentPlan(process.env)) {
      run(command);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Vercel Convex deployment failed");
    process.exitCode = 1;
  }
}
