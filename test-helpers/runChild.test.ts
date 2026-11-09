import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHILD_TEST_TIMEOUT_MS, runChild } from "./runChild";

const SYNC_SPAWN_PATTERN = /\b(spawnSync|execFileSync|execSync)\b/;

test(
  "Returns the exit status, output, and stdin round trip of a child",
  async () => {
    const result = await runChild(
      process.execPath,
      ["-e", "process.stdout.write(await Bun.stdin.text()); console.error('err'); process.exit(3)"],
      { input: "hello" }
    );
    expect(result).toEqual({ signal: null, status: 3, stderr: "err\n", stdout: "hello" });
  },
  CHILD_TEST_TIMEOUT_MS
);

test(
  "Kills a child that outlives its timeout instead of hanging the test",
  async () => {
    const started = performance.now();
    const result = await runChild(process.execPath, ["-e", "await Bun.sleep(60_000)"], {
      timeoutMs: 200,
    });
    expect(result.signal).toBe("SIGKILL");
    expect(result.status).toBeNull();
    expect(performance.now() - started).toBeLessThan(10_000);
  },
  CHILD_TEST_TIMEOUT_MS
);

test(
  "Keeps synchronous child processes out of test files",
  async () => {
    const listing = await runChild("git", ["ls-files", "-z", "--", "*.test.*", "test-helpers/*"], {
      cwd: resolve(import.meta.dir, ".."),
    });
    expect(listing.status).toBe(0);
    const offenders: string[] = [];
    for (const path of listing.stdout.split("\0").filter(Boolean)) {
      if (path === "test-helpers/runChild.test.ts") {
        continue;
      }
      const source = readFileSync(resolve(import.meta.dir, "..", path), "utf8");
      if (SYNC_SPAWN_PATTERN.test(source)) {
        offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  },
  CHILD_TEST_TIMEOUT_MS
);
