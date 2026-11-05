import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeConvexDeploymentSourceHash } from "./convex-source-fingerprint";

test("React email source changes invalidate backend identity while JSX/TSX tests remain excluded", () => {
  const root = mkdtempSync(join(tmpdir(), "citius-email-fingerprint-"));
  try {
    execFileSync("git", ["init", "--quiet", root]);
    mkdirSync(join(root, "convex"));
    writeFileSync(join(root, "convex", "email.tsx"), "export const email = <p>Original</p>;");
    const original = computeConvexDeploymentSourceHash(root);
    writeFileSync(join(root, "convex", "email.tsx"), "export const email = <p>Changed</p>;");
    const changed = computeConvexDeploymentSourceHash(root);
    expect(changed).not.toBe(original);
    writeFileSync(join(root, "convex", "email.test.tsx"), "test-only change");
    writeFileSync(join(root, "convex", "email.test.jsx"), "test-only change");
    expect(computeConvexDeploymentSourceHash(root)).toBe(changed);
    writeFileSync(join(root, "convex", "otherEmail.jsx"), "export const email = <p>New</p>;");
    expect(computeConvexDeploymentSourceHash(root)).not.toBe(changed);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
