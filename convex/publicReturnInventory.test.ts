import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  discoverConvexRegistrations,
  registrationsInSource,
} from "../config/release/convex-registration-inventory";

const CONVEX_ROOT = new URL(".", import.meta.url).pathname;
const BROAD_ROOT_RETURN = /returns:\s*v\.(?:any|optional)\(v\.any\(\)\)/;
const ALLOWED_REGISTRATION_FACTORIES = new Set(["crm/commercialFiles.ts:mutationWithAccess"]);
const INTERNAL_RETURN_GAPS_PATH = join(
  CONVEX_ROOT,
  "../config/release/convex-internal-return-gaps.txt"
);

const SERVER_TO_SERVER = new Set([
  "aiRuntime.ts:consumeRateLimit",
  "aiRuntime.ts:recordTelemetry",
  "authSync.ts:repairAuthLinks",
  "bookings.ts:confirmBookingByOrderId",
  "bookings.ts:markPaymentFailedByOrderId",
  "bookings.ts:markRefundedByPaymentId",
  "bookings.ts:recordPaymentAuthorized",
  "trips.ts:createTrip",
]);

function inventory() {
  return discoverConvexRegistrations(CONVEX_ROOT, ALLOWED_REGISTRATION_FACTORIES).map((entry) => ({
    block: entry.block,
    id: `${entry.file}:${entry.name}`,
    kind: entry.kind,
  }));
}

function knownInternalReturnGaps() {
  return readFileSync(INTERNAL_RETURN_GAPS_PATH, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

describe("Convex export return inventory", () => {
  test("fails closed when a registration factory is not explicitly allowed", () => {
    const source = `
      import { mutation } from "./_generated/server";
      const hiddenRegistration = (config: object) => mutation(config as never);
      export const hiddenCapability = hiddenRegistration({ args: {}, handler() {} });
    `;
    expect(() => registrationsInSource(source, "fixture.ts")).toThrow(
      "Unrecognized Convex registration factory fixture.ts:hiddenRegistration"
    );
  });

  test("classifies public, internal, and secret-authenticated server entry points", () => {
    const entries = inventory();
    const publicEntries = entries.filter((entry) => !entry.kind.startsWith("internal"));
    const internalEntries = entries.filter((entry) => entry.kind.startsWith("internal"));
    const serverEntries = publicEntries.filter((entry) => SERVER_TO_SERVER.has(entry.id));

    expect(publicEntries.length).toBeGreaterThan(0);
    expect(internalEntries.length).toBeGreaterThan(0);
    expect(serverEntries.map((entry) => entry.id).sort()).toEqual([...SERVER_TO_SERVER].sort());
  });

  test("every public function declares a non-broad root return contract", () => {
    const publicEntries = inventory().filter((entry) => !entry.kind.startsWith("internal"));
    for (const entry of publicEntries) {
      expect(entry.block, entry.id).toContain("returns:");
      expect(entry.block, entry.id).not.toMatch(BROAD_ROOT_RETURN);
    }
  });

  test("fails on new internal return gaps and names every existing exception", () => {
    const currentGaps = inventory()
      .filter((entry) => entry.kind.startsWith("internal") && !entry.block.includes("returns:"))
      .map((entry) => entry.id)
      .sort();
    const baseline = knownInternalReturnGaps().sort();

    expect(new Set(baseline).size).toBe(baseline.length);
    expect(currentGaps).toEqual(baseline);
    expect(currentGaps).toHaveLength(50);
  });

  test("validates every wrapped Commercial Files mutation response", () => {
    const ids = new Set([
      "crm/commercialFiles.ts:updateNote",
      "crm/commercialFiles.ts:deleteFile",
      "crm/commercialFiles.ts:deleteCurrentProposalDoc",
      "crm/commercialFiles.ts:restoreFile",
      "crm/commercialFiles.ts:restoreProposalHistory",
    ]);
    const entries = inventory().filter((entry) => ids.has(entry.id));
    expect(entries).toHaveLength(ids.size);
    for (const entry of entries) {
      expect(entry.block, entry.id).toContain("returns:");
      expect(entry.block, entry.id).toContain("successResultValidator");
    }
  });

  test("does not expose the retired pending approval counter", () => {
    expect(inventory().map((entry) => entry.id)).not.toContain("crm/approvals.ts:pendingCount");
  });
});
