import { describe, expect, test } from "bun:test";
import { createVercelConvexDeploymentPlan } from "./vercel-convex-deploy";

const revision = "a5c5f0906d0cf9198cafd2459ad208c7554ca3dc";

describe("Vercel Convex deployment metadata", () => {
  test("deploys before atomically stamping the selected hosted target", () => {
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
