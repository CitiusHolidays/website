import { describe, expect, test } from "bun:test";
import { file as bunFile, Glob } from "bun";
import {
  assertRunMutationArgs,
  findRunMutationReversedCallLines,
  mapMutationError,
  runMutation,
} from "./runMutation.js";

const ARGUMENT_ORDER_PATTERN = /arguments look reversed/i;
const FUNCTION_ARGUMENT_PATTERN = /second argument must be a function/i;

describe("RunMutation", () => {
  test("Returns result and calls success toast on success", async () => {
    const messages = [];
    const showToast = {
      error: (msg) => messages.push(["error", msg]),
      success: (msg) => messages.push(["success", msg]),
    };
    const result = await runMutation({ label: "Query", showToast }, async () => "ok");
    expect(result).toBe("ok");
    expect(messages).toEqual([["success", "Query saved"]]);
  });

  test("Supports success messages derived from the result", async () => {
    const messages = [];
    const showToast = {
      error: (msg) => messages.push(["error", msg]),
      success: (msg) => messages.push(["success", msg]),
    };
    const result = await runMutation(
      { showToast, successMessage: (value) => `Saved ${value.count}` },
      async () => ({ count: 2 })
    );
    expect(result).toEqual({ count: 2 });
    expect(messages).toEqual([["success", "Saved 2"]]);
  });

  test("Throws and maps errors to toast", async () => {
    const messages = [];
    const showToast = {
      error: (msg) => messages.push(["error", msg]),
      success: (msg) => messages.push(["success", msg]),
    };
    await expect(
      runMutation({ showToast }, () => {
        throw new Error("Denied");
      })
    ).rejects.toThrow("Denied");
    expect(messages).toEqual([["error", "Denied"]]);
  });

  test("MapMutationError prefers structured data", () => {
    expect(mapMutationError({ data: "Not allowed", message: "x" })).toBe("Not allowed");
  });

  test("Rejects reversed arguments with a clear error", () => {
    expect(() => assertRunMutationArgs({ showToast: {} }, async () => "ok")).not.toThrow();
    expect(() => assertRunMutationArgs(async () => "ok", { showToast: {} })).toThrow(
      ARGUMENT_ORDER_PATTERN
    );
    expect(() => assertRunMutationArgs({ showToast: {} }, null)).toThrow(FUNCTION_ARGUMENT_PATTERN);
  });

  test("Call sites pass options before fn", async () => {
    const glob = new Glob("**/*.{js,jsx}");
    const violations = [];
    for await (const relativePath of glob.scan({ cwd: "src", onlyFiles: true })) {
      const path = `src/${relativePath}`;
      const source = await bunFile(path).text();
      if (!source.includes("runMutation")) {
        continue;
      }
      const lines = findRunMutationReversedCallLines(source);
      for (const line of lines) {
        violations.push(`${path}:${line}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
