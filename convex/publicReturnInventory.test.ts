import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const CONVEX_ROOT = new URL(".", import.meta.url).pathname;
const REGISTRATION =
  /export\s+const\s+(\w+)\s*=\s*(query|mutation|action|internalQuery|internalMutation|internalAction)\s*\(\{/g;
const BROAD_ROOT_RETURN = /returns:\s*v\.(?:any|optional)\(v\.any\(\)\)/;

const SERVER_TO_SERVER = new Set([
  "aiRuntime.ts:consumeRateLimit",
  "aiRuntime.ts:recordTelemetry",
  "authSync.ts:repairAuthLinks",
  "bookings.ts:confirmBookingByOrderId",
  "bookings.ts:markPaymentFailedByOrderId",
  "bookings.ts:markRefundedByPaymentId",
  "bookings.ts:recordPaymentAuthorized",
  "crm/e2eAssertions.ts:travellerExists",
  "crm/e2eSeedActions.ts:run",
  "trips.ts:createTrip",
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (name === "_generated" || name === "node_modules") {
      return [];
    }
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}

function registrationBlock(source: string, start: number) {
  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}" && --depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  throw new Error("Unterminated Convex registration");
}

function inventory() {
  return sourceFiles(CONVEX_ROOT).flatMap((path) => {
    const source = readFileSync(path, "utf8");
    return Array.from(source.matchAll(REGISTRATION), (match) => ({
      block: registrationBlock(source, match.index ?? 0),
      id: `${relative(CONVEX_ROOT, path)}:${match[1]}`,
      kind: match[2],
    }));
  });
}

describe("Convex export return inventory", () => {
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
});
