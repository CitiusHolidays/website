import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { evaluateConvexCiCredential } from "./convex-ci-credentials";

const root = resolve(import.meta.dir, "../..");

describe("Convex CI credential policy", () => {
  test("accepts only a deployment-scoped development key", () => {
    expect(evaluateConvexCiCredential("dev:ci-quality-123|redacted")).toEqual({
      error: null,
      ok: true,
    });
    expect(evaluateConvexCiCredential("prod:production-123|redacted").ok).toBe(false);
    expect(evaluateConvexCiCredential("preview:team:project|redacted").ok).toBe(false);
    expect(evaluateConvexCiCredential("project:team:project|redacted").ok).toBe(false);
  });

  test("fails closed when the key is missing or malformed", () => {
    expect(evaluateConvexCiCredential(undefined)).toEqual({
      error: "Required non-production Convex CI credential is not configured",
      ok: false,
    });
    expect(evaluateConvexCiCredential("dev:missing-token|").ok).toBe(false);
  });

  test("the CLI never prints the credential value", () => {
    const credential = "prod:must-never-print|private-token-value";
    const result = spawnSync("bun", ["config/release/convex-ci-credentials.ts"], {
      cwd: root,
      encoding: "utf8",
      env: { CONVEX_DEPLOY_KEY: credential, PATH: process.env.PATH },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("deployment-scoped dev key");
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(credential);
  });
});
