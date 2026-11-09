import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CHILD_TEST_TIMEOUT_MS, runChild } from "../../test-helpers/runChild";
import { CONVEX_SOURCE_LIST_ARGS, hashConvexDeploymentSource } from "./convex-source-fingerprint";

async function sourceHash(root: string) {
  const listing = await runChild("git", CONVEX_SOURCE_LIST_ARGS, { cwd: root });
  expect(listing.status).toBe(0);
  return hashConvexDeploymentSource(root, listing.stdout);
}

test(
  "React email source changes invalidate backend identity while JSX/TSX tests remain excluded",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "citius-email-fingerprint-"));
    try {
      expect((await runChild("git", ["init", "--quiet", root])).status).toBe(0);
      mkdirSync(join(root, "convex"));
      writeFileSync(join(root, "convex", "email.tsx"), "export const email = <p>Original</p>;");
      const original = await sourceHash(root);
      writeFileSync(join(root, "convex", "email.tsx"), "export const email = <p>Changed</p>;");
      const changed = await sourceHash(root);
      expect(changed).not.toBe(original);
      writeFileSync(join(root, "convex", "email.test.tsx"), "test-only change");
      writeFileSync(join(root, "convex", "email.test.jsx"), "test-only change");
      expect(await sourceHash(root)).toBe(changed);
      writeFileSync(join(root, "convex", "otherEmail.jsx"), "export const email = <p>New</p>;");
      expect(await sourceHash(root)).not.toBe(changed);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  },
  CHILD_TEST_TIMEOUT_MS
);
