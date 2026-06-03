import { describe, expect, test } from "bun:test";
import { mapMutationError, runMutation } from "./runMutation.js";

describe("runMutation", () => {
  test("returns result and calls success toast on success", async () => {
    const messages = [];
    const showToast = {
      success: (msg) => messages.push(["success", msg]),
      error: (msg) => messages.push(["error", msg]),
    };
    const result = await runMutation({ label: "Query", showToast }, async () => "ok");
    expect(result).toBe("ok");
    expect(messages).toEqual([["success", "Query saved"]]);
  });

  test("supports success messages derived from the result", async () => {
    const messages = [];
    const showToast = {
      success: (msg) => messages.push(["success", msg]),
      error: (msg) => messages.push(["error", msg]),
    };
    const result = await runMutation(
      { showToast, successMessage: (value) => `Saved ${value.count}` },
      async () => ({ count: 2 }),
    );
    expect(result).toEqual({ count: 2 });
    expect(messages).toEqual([["success", "Saved 2"]]);
  });

  test("throws and maps errors to toast", async () => {
    const messages = [];
    const showToast = {
      success: (msg) => messages.push(["success", msg]),
      error: (msg) => messages.push(["error", msg]),
    };
    await expect(
      runMutation({ showToast }, async () => {
        throw new Error("Denied");
      }),
    ).rejects.toThrow("Denied");
    expect(messages).toEqual([["error", "Denied"]]);
  });

  test("mapMutationError prefers structured data", () => {
    expect(mapMutationError({ data: "Not allowed", message: "x" })).toBe("Not allowed");
  });
});
