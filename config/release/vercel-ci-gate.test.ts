import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const workflow = readFileSync(resolve(root, ".github/workflows/vercel-deploy.yml"), "utf8");
// SAFETY: This test reads the repository-owned Vercel JSON object fixture.
const vercelConfig = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as {
  git?: { deploymentEnabled?: boolean };
};
const TEMPLATE_DOLLAR = String.fromCodePoint(36);

describe("Vercel build-after-green release gate", () => {
  test("turns off independent Git builds so CI is the only deployment initiator", () => {
    expect(vercelConfig.git?.deploymentEnabled).toBe(false);
  });

  test("uses only a successful Hosted Quality run from this repository and exact revision", () => {
    expect(workflow).toContain('workflows: ["Hosted Quality"]');
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain(
      "github.event.workflow_run.head_repository.full_name == github.repository"
    );
    expect(workflow).toContain(`ref: ${TEMPLATE_DOLLAR}{{ github.event.workflow_run.head_sha }}`);
    expect(workflow).toContain(
      `PREVIEW_BRANCH: ${TEMPLATE_DOLLAR}{{ github.event.workflow_run.head_branch }}`
    );
    expect(workflow).toContain('--git-branch="$PREVIEW_BRANCH"');
    expect(workflow).not.toContain(
      `--git-branch="${TEMPLATE_DOLLAR}{{ github.event.workflow_run.head_branch }}"`
    );
    expect(workflow).not.toContain("continue-on-error");
  });

  test("keeps Preview and Production independently inert until explicitly activated", () => {
    expect(workflow).toContain("vars.VERCEL_CI_PREVIEW_ENABLED == 'true'");
    expect(workflow).toContain("vars.VERCEL_CI_PRODUCTION_ENABLED == 'true'");
    expect(workflow).toContain("environment: preview");
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
  });

  test("refuses a delayed or rerun Production job once main has advanced", () => {
    expect(workflow).toContain("git ls-remote --exit-code origin refs/heads/main");
    expect(workflow.match(/current_main_sha/g)).toHaveLength(4);
    expect(workflow).toContain('if [ "$current_main_sha" != "$GATED_SHA" ]');
    expect(
      workflow.indexOf("Refuse a stale Production revision before the target-bound build")
    ).toBeLessThan(workflow.indexOf("Build the Production artifact"));
    expect(
      workflow.indexOf("Refuse a stale Production revision before frontend staging")
    ).toBeLessThan(workflow.indexOf("Stage the prebuilt Production artifact"));
  });

  test("builds and deploys prebuilt artifacts without a bypass flag", () => {
    expect(workflow).toContain("vercel@59.1.4 pull --yes --environment=preview");
    expect(workflow).toContain("vercel@59.1.4 build --token");
    expect(workflow).toContain("vercel@59.1.4 deploy --prebuilt --token");
    expect(workflow).toContain("vercel@59.1.4 build --prod --token");
    expect(workflow).toContain("vercel@59.1.4 deploy --prebuilt --prod --skip-domain");
    expect(workflow).toContain("domains intentionally unassigned");
    expect(workflow).not.toContain("--force");
    expect(workflow).not.toContain("vercel promote");
  });
});
