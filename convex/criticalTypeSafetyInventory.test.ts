import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONVEX_ROOT = new URL(".", import.meta.url).pathname;
const CRITICAL_FILES = [
  "customerConfirmedTrips.ts",
  "crm/inboundQueryIntents.ts",
  "crm/seatCommands.ts",
  "crm/financeOverviewReads.ts",
];
const ANY_CONTEXT = /ctx:\s*any\b/;

describe("critical Convex helper type safety", () => {
  test("keeps the P210 performance loci on concrete Convex contexts", () => {
    for (const file of CRITICAL_FILES) {
      const source = readFileSync(join(CONVEX_ROOT, file), "utf8");
      expect(source, file).not.toMatch(ANY_CONTEXT);
    }
  });
});
