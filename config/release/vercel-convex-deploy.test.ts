import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createVercelConvexDeploymentPlan } from "./vercel-convex-deploy";

const revision = "a5c5f0906d0cf9198cafd2459ad208c7554ca3dc";

describe("Vercel Convex deployment metadata", () => {
  test("plans the integrated build/deploy command before the Production metadata update", () => {
    expect(
      createVercelConvexDeploymentPlan({
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_SHA: revision,
      })
    ).toEqual([
      {
        args: ["convex", "deploy", "--cmd", "bun run build"],
        executable: "bunx",
      },
      {
        args: ["convex", "env", "set", "--force"],
        executable: "bunx",
        stdin: `OPERATIONAL_CONTROL_SOURCE_REVISION=${revision}\nVERCEL_ENV=production\n`,
      },
    ]);
  });

  test("leaves Preview deployment metadata unchanged", () => {
    expect(createVercelConvexDeploymentPlan({ VERCEL_ENV: "preview" })).toEqual([
      {
        args: ["convex", "deploy", "--cmd", "bun run build"],
        executable: "bunx",
      },
    ]);
  });

  test("fails closed without an exact Production target and Git revision", () => {
    for (const environment of [undefined, "development", "Production"]) {
      expect(() =>
        createVercelConvexDeploymentPlan({
          VERCEL_ENV: environment,
          VERCEL_GIT_COMMIT_SHA: revision,
        })
      ).toThrow("VERCEL_ENV must be preview or production");
    }

    for (const sourceRevision of [undefined, "abc1234", "A".repeat(40)]) {
      expect(() =>
        createVercelConvexDeploymentPlan({
          VERCEL_ENV: "production",
          VERCEL_GIT_COMMIT_SHA: sourceRevision,
        })
      ).toThrow("VERCEL_GIT_COMMIT_SHA must be an exact 40-character lowercase Git revision");
    }
  });
});

function exerciseWrapper(options: {
  deployStatus?: number;
  environment: string;
  metadataStatus?: number;
  sourceRevision?: string;
}) {
  const directory = mkdtempSync(join(tmpdir(), "citius-release-wrapper-"));
  const commandsPath = join(directory, "commands.log");
  const metadataPath = join(directory, "metadata.txt");
  const executable = join(directory, "bunx");
  try {
    // The isolated PATH contains only this fake. No provider CLI or credentials are used.
    writeFileSync(
      executable,
      `#!/bin/sh
printf '%s\\n' "$*" >> "$CITIUS_PROBE_COMMANDS"
if [ "$2" = "env" ]; then
  /bin/cat > "$CITIUS_PROBE_METADATA"
  exit "$CITIUS_PROBE_METADATA_STATUS"
fi
exit "$CITIUS_PROBE_DEPLOY_STATUS"
`
    );
    chmodSync(executable, 0o700);
    const result = spawnSync(
      process.execPath,
      [resolve(import.meta.dir, "vercel-convex-deploy.ts")],
      {
        cwd: directory,
        encoding: "utf8",
        env: {
          CITIUS_PROBE_COMMANDS: commandsPath,
          CITIUS_PROBE_DEPLOY_STATUS: String(options.deployStatus ?? 0),
          CITIUS_PROBE_METADATA: metadataPath,
          CITIUS_PROBE_METADATA_STATUS: String(options.metadataStatus ?? 0),
          PATH: directory,
          VERCEL_ENV: options.environment,
          VERCEL_GIT_COMMIT_SHA: options.sourceRevision,
        },
      }
    );
    if (result.error) {
      throw result.error;
    }
    return {
      commands: existsSync(commandsPath)
        ? readFileSync(commandsPath, "utf8").trim().split("\n")
        : [],
      metadata: existsSync(metadataPath) ? readFileSync(metadataPath, "utf8") : null,
      status: result.status,
      stderr: result.stderr,
    };
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

describe("Vercel Convex wrapper execution", () => {
  test("passes the reviewed metadata only after the integrated command succeeds", () => {
    const result = exerciseWrapper({ environment: "production", sourceRevision: revision });
    expect(result.status).toBe(0);
    expect(result.commands).toEqual([
      "convex deploy --cmd bun run build",
      "convex env set --force",
    ]);
    expect(result.metadata).toBe(
      `OPERATIONAL_CONTROL_SOURCE_REVISION=${revision}\nVERCEL_ENV=production\n`
    );
  });

  test("does not attempt a metadata update after the build/deploy command fails", () => {
    const result = exerciseWrapper({
      deployStatus: 17,
      environment: "production",
      sourceRevision: revision,
    });
    expect(result.status).toBe(1);
    expect(result.commands).toEqual(["convex deploy --cmd bun run build"]);
    expect(result.metadata).toBeNull();
    expect(result.stderr).toContain("failed with exit code 17");
  });

  test("fails the Vercel build when the Production metadata update is rejected", () => {
    const result = exerciseWrapper({
      environment: "production",
      metadataStatus: 18,
      sourceRevision: revision,
    });
    expect(result.status).toBe(1);
    expect(result.commands).toEqual([
      "convex deploy --cmd bun run build",
      "convex env set --force",
    ]);
    expect(result.stderr).toContain("convex env set --force failed with exit code 18");
  });

  test("runs Preview without a Production metadata update", () => {
    const result = exerciseWrapper({ environment: "preview" });
    expect(result.status).toBe(0);
    expect(result.commands).toEqual(["convex deploy --cmd bun run build"]);
    expect(result.metadata).toBeNull();
  });

  test("rejects missing Production identity before starting any child command", () => {
    const result = exerciseWrapper({ environment: "production" });
    expect(result.status).toBe(1);
    expect(result.commands).toEqual([]);
    expect(result.metadata).toBeNull();
    expect(result.stderr).toContain("VERCEL_GIT_COMMIT_SHA must be an exact");
  });

  test("rejects an unsupported environment before starting any child command", () => {
    const result = exerciseWrapper({ environment: "development", sourceRevision: revision });
    expect(result.status).toBe(1);
    expect(result.commands).toEqual([]);
    expect(result.metadata).toBeNull();
    expect(result.stderr).toContain("VERCEL_ENV must be preview or production");
  });
});
