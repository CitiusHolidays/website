import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT_INPUTS = ["bun.lock", "convex", "convex.json", "package.json"] as const;
const DEPLOYMENT_IDENTITY_PATH = "convex/e2eDeploymentIdentity.ts";
const CONVEX_SOURCE_EXTENSION_PATTERN = /\.(?:js|json|ts)$/;
const TEST_SOURCE_PATTERN = /\.(?:convex\.integration|integration|test)\.(?:js|ts)$/;

export function convexDeploymentSourceFiles(root: string) {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", ...ROOT_INPUTS],
    { cwd: root, encoding: "utf8", shell: false }
  );
  if (result.status !== 0) {
    throw new Error("Unable to enumerate Convex deployment source files");
  }
  return result.stdout
    .split("\0")
    .filter(Boolean)
    .filter((path) => {
      if (path === DEPLOYMENT_IDENTITY_PATH) {
        return false;
      }
      if (!path.startsWith("convex/")) {
        return ROOT_INPUTS.includes(path as (typeof ROOT_INPUTS)[number]);
      }
      return (
        !(path.startsWith("convex/_generated/") || TEST_SOURCE_PATTERN.test(path)) &&
        CONVEX_SOURCE_EXTENSION_PATTERN.test(path)
      );
    })
    .sort((left, right) => left.localeCompare(right));
}

export function computeConvexDeploymentSourceHash(root: string) {
  const files = convexDeploymentSourceFiles(root);
  if (files.length === 0) {
    throw new Error("Convex deployment source fingerprint has no inputs");
  }
  const hash = createHash("sha256");
  for (const path of files) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(resolve(root, path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}
