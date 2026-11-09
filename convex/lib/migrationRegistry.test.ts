import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { migrationRegistryState, startedMigrationRegistry } from "./migrationRegistry";

const CONVEX_ROOT = new URL("..", import.meta.url).pathname;
const NOW = 1_800_000_000_000;
const REGISTRY_WRITE = /ctx\.db\.(insert|patch|replace)\(\s*"dataMigrationRegistry"/g;
const OWN_STATUS_FIELD = /^\s*(status|verifiedAt)\b\s*[:,]/m;
const HELPER_SPREAD = /\.\.\.(migrationRegistryState|startedMigrationRegistry)\(/;
const SOURCE_TEST_FILE = /\.(test|convex\.integration)\.ts$/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "_generated" || entry.name === "testSupport" ? [] : sourceFiles(path);
    }
    const isTest = SOURCE_TEST_FILE.test(entry.name);
    return entry.name.endsWith(".ts") && !isTest ? [path] : [];
  });
}

/** The text of a call's argument list, from its opening parenthesis to the matching one. */
function callArguments(source: string, open: number) {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "(") {
      depth += 1;
    } else if (source[index] === ")") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open + 1, index);
      }
    }
  }
  throw new Error("Unbalanced call");
}

/** Every registry write in the Convex source, as `file:line` with its kind and arguments. */
function registryWrites() {
  return sourceFiles(CONVEX_ROOT).flatMap((path) => {
    const source = readFileSync(path, "utf8");
    return [...source.matchAll(REGISTRY_WRITE)].map((match) => {
      const open = (match.index ?? 0) + match[0].indexOf("(");
      const line = source.slice(0, match.index).split("\n").length;
      return {
        args: callArguments(source, open),
        kind: match[1],
        where: `${relative(CONVEX_ROOT, path)}:${line}`,
      };
    });
  });
}

describe("migration registry status", () => {
  test("verifiedAt is stamped exactly when the status is verified", () => {
    expect(
      migrationRegistryState(
        { cursor: null, legacyRemaining: 0, stage: "complete", status: "verified" },
        NOW
      )
    ).toEqual({
      cursor: null,
      legacyRemaining: 0,
      stage: "complete",
      status: "verified",
      updatedAt: NOW,
      verifiedAt: NOW,
    });
    for (const status of ["pending", "running", "failed"] as const) {
      const state = migrationRegistryState(
        { cursor: null, legacyRemaining: 3, stage: "complete", status },
        NOW
      );
      // Present and undefined, so a patch removes a verification time left from an earlier run.
      expect(state).toHaveProperty("verifiedAt", undefined);
      expect(state.status).toBe(status);
    }
  });

  test("refuses to mark a migration verified while it has a cursor, residuals or stages left", () => {
    for (const progress of [
      { cursor: "next-page", legacyRemaining: 0, stage: "complete" },
      { cursor: null, legacyRemaining: 2, stage: "complete" },
      { cursor: null, legacyRemaining: 0, stage: "verify" },
    ]) {
      expect(() => migrationRegistryState({ ...progress, status: "verified" }, NOW)).toThrow(
        "A migration can be verified only when complete"
      );
    }
  });

  test("a started or restarted migration is running from zero with no verification time", () => {
    expect(startedMigrationRegistry("backfill", NOW)).toEqual({
      converted: 0,
      cursor: null,
      legacyRemaining: 0,
      processed: 0,
      stage: "backfill",
      startedAt: NOW,
      status: "running",
      updatedAt: NOW,
      verifiedAt: undefined,
    });
  });

  test("every registry write sets its status through migrationRegistry", () => {
    const writes = registryWrites();
    // Guards the scan itself: the registry has writers in the root and in crm/.
    expect(writes.length).toBeGreaterThan(20);
    for (const write of writes) {
      expect(write.kind, write.where).not.toBe("replace");
      expect(write.args, write.where).toMatch(HELPER_SPREAD);
      // The status and its verification time come only from the helper's spread.
      const spread = write.args.search(HELPER_SPREAD);
      const helperCall = callArguments(write.args, write.args.indexOf("(", spread));
      const ownFields = write.args.replace(helperCall, "");
      expect(ownFields, write.where).not.toMatch(OWN_STATUS_FIELD);
    }
  });
});
