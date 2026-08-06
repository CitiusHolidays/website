import { describe, expect, test } from "bun:test";
import {
  evaluateCiPolicy,
  findSecretMatches,
  findWorkflowPolicyViolations,
} from "./check-ci-policy";

const pinnedWorkflow = `
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  quality:
    steps:
      - name: Fail closed for fork pull requests
        if: github.event.pull_request.head.repo.full_name != github.repository
        run: exit 1
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: oven-sh/setup-bun@735343b667d3e6f658f44d0eca948eb6282f2b76
        with:
          bun-version: 1.3.14
      - run: bun run env:preflight -- --target preview
      - run: bunx convex codegen --typecheck enable
      - run: bun run test
`;

describe("CI and secret policy", () => {
  test("accepts pinned actions, exact Bun, and codegen before tests", () => {
    expect(findWorkflowPolicyViolations(pinnedWorkflow)).toEqual([]);
  });

  test("rejects mutable actions, unsafe pull request triggers, and raw test commands", () => {
    const workflow = pinnedWorkflow
      .replace("actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683", "actions/checkout@v4")
      .replace("bun-version: 1.3.14", "bun-version: 1.x")
      .replace("- run: bun run test", "- run: bun test\n      - run: bun run test")
      .replace("permissions:\n  contents: read", "permissions:\n  contents: write")
      .concat("\non:\n  pull_request_target:\n");

    const violations = findWorkflowPolicyViolations(workflow);
    expect(violations).toEqual([
      "required-quality workflow must grant contents: read explicitly",
      "required-quality workflow must not use pull_request_target",
      "workflow action must use an immutable commit: actions/checkout@v4",
      "workflow must pin Bun to 1.3.14",
      "workflow must use bun run test so the repository test policy is applied",
    ]);
  });

  test("requires PR and main triggers, a pre-checkout fork guard, and environment preflight", () => {
    const workflow = pinnedWorkflow
      .replace("  pull_request:\n", "")
      .replace("  push:\n    branches: [main]\n", "")
      .replace("      - run: bun run env:preflight -- --target preview\n", "")
      .replace(
        "      - name: Fail closed for fork pull requests\n        if: github.event.pull_request.head.repo.full_name != github.repository\n        run: exit 1\n",
        ""
      );

    expect(findWorkflowPolicyViolations(workflow)).toEqual([
      "fork pull requests must fail closed before repository checkout",
      "required-quality workflow must run for pull requests",
      "required-quality workflow must run for pushes to main",
      "required-quality workflow must run the preview environment preflight",
    ]);
  });

  test("rejects branch-only core gates and globally scoped Convex credentials", () => {
    const workflow = `${pinnedWorkflow}\nenv:\n  CONVEX_DEPLOY_KEY: unsafe\nif: github.ref == 'refs/heads/main'\n`;

    expect(findWorkflowPolicyViolations(workflow)).toEqual([
      "Convex CI credentials must be scoped to individual steps",
      "required quality gates must not be restricted to the main ref",
    ]);
  });

  test("reports high-confidence credentials without printing their values", () => {
    const stripeKey = ["sk", "_live_", "a".repeat(24)].join("");
    const privateKeyHeader = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
    const findings = findSecretMatches([
      { path: "config.txt", source: `key=${stripeKey}\n${privateKeyHeader}` },
      { path: ".env.example", source: `RESEND_API_KEY=${stripeKey}` },
    ]);

    expect(findings).toEqual([
      { line: 1, path: "config.txt", rule: "stripe-or-razorpay-key" },
      { line: 2, path: "config.txt", rule: "private-key-header" },
    ]);
    expect(JSON.stringify(findings)).not.toContain(stripeKey);
  });

  test("combines workflow and secret policy findings for the CI entrypoint", () => {
    const result = evaluateCiPolicy({
      files: [{ path: "fixture.txt", source: `x=${["ghp_", "a".repeat(24)].join("")}` }],
      workflow: pinnedWorkflow,
    });
    expect(result.workflow).toEqual([]);
    expect(result.secrets).toEqual([{ line: 1, path: "fixture.txt", rule: "github-token" }]);
  });
});
