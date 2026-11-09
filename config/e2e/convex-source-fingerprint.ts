import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT_INPUTS = ["bun.lock", "convex", "convex.json", "package.json"] as const;
const DEPLOYMENT_IDENTITY_PATH = "convex/e2eDeploymentIdentity.ts";
const CONVEX_SOURCE_EXTENSION_PATTERN = /\.(?:jsx?|json|tsx?)$/;
const TEST_SOURCE_PATTERN = /\.(?:convex\.integration|integration|test)\.(?:jsx?|tsx?)$/;

/** `git` arguments that list the deployable Convex source candidates, NUL-separated. */
export const CONVEX_SOURCE_LIST_ARGS = [
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "-z",
  "--",
  ...ROOT_INPUTS,
] as const;

function convexDeploymentSourceFiles(gitListing: string) {
  return gitListing
    .split("\0")
    .filter(Boolean)
    .filter((path) => {
      if (path === DEPLOYMENT_IDENTITY_PATH) {
        return false;
      }
      if (!path.startsWith("convex/")) {
        return ROOT_INPUTS.some((candidate) => candidate === path);
      }
      return (
        !(path.startsWith("convex/_generated/") || TEST_SOURCE_PATTERN.test(path)) &&
        CONVEX_SOURCE_EXTENSION_PATTERN.test(path)
      );
    })
    .sort((left, right) => left.localeCompare(right));
}

/** Hashes the files named by a `git CONVEX_SOURCE_LIST_ARGS` listing taken in `root`. */
export function hashConvexDeploymentSource(root: string, gitListing: string) {
  const files = convexDeploymentSourceFiles(gitListing);
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

export function computeConvexDeploymentSourceHash(root: string) {
  const result = spawnSync("git", [...CONVEX_SOURCE_LIST_ARGS], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error("Unable to enumerate Convex deployment source files");
  }
  return hashConvexDeploymentSource(root, result.stdout);
}
