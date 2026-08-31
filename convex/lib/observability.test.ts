import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildConvexApplicationErrorLog, logConvexApplicationError } from "./observability";

describe("Convex application error normalization", () => {
  test("emits only a closed category and fixed event metadata", () => {
    const payload = buildConvexApplicationErrorLog(
      "passport_storage_cleanup_failure",
      () => new Date("2026-08-30T00:00:00.000Z")
    );
    expect(payload).toEqual({
      category: "passport_storage_cleanup_failure",
      event: "convex.application.error",
      service: "citius-convex",
      timestamp: "2026-08-30T00:00:00.000Z",
    });
    expect(JSON.stringify(payload)).not.toContain("customer@example.test");
    expect(JSON.stringify(payload)).not.toContain("token-private-sentinel");
    expect(JSON.stringify(payload)).not.toContain("record-id-private-sentinel");
  });

  test("cannot change workflow behavior when the log sink fails", () => {
    expect(() =>
      logConvexApplicationError("passenger_import_row_failure", {
        error: () => {
          throw new Error("sink unavailable");
        },
      })
    ).not.toThrow();
  });

  test("selected privacy boundaries no longer pass raw exceptions to console", () => {
    for (const file of ["crm/importProcessor.ts", "crm/passportActions.ts"]) {
      const source = readFileSync(join(process.cwd(), "convex", file), "utf8");
      expect(source, file).not.toContain("console.error");
      expect(source, file).toContain("logConvexApplicationError");
    }
  });
});
