import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const workflow = readFileSync(resolve(root, ".github/workflows/vercel-deploy.yml"), "utf8");
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
    expect(workflow).not.toContain("continue-on-error");
  });

  test("keeps Preview and Production independently inert until explicitly activated", () => {
    expect(workflow).toContain("vars.VERCEL_CI_PREVIEW_ENABLED == 'true'");
    expect(workflow).toContain("vars.VERCEL_CI_PRODUCTION_ENABLED == 'true'");
    expect(workflow).toContain("environment: preview");
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
  });

  test("builds and deploys prebuilt artifacts without a bypass flag", () => {
    expect(workflow).toContain("vercel@59.1.4 pull --yes --environment=preview");
    expect(workflow).toContain("vercel@59.1.4 build --token");
    expect(workflow).toContain("vercel@59.1.4 deploy --prebuilt --token");
    expect(workflow).toContain("vercel@59.1.4 build --prod --token");
    expect(workflow).toContain("vercel@59.1.4 deploy --prebuilt --prod --token");
    expect(workflow).not.toContain("--force");
  });
});
