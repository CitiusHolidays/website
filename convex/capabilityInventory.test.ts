import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

type CapabilityClass = "admin-only" | "internal" | "migration" | "public-product" | "server-only";

interface Capability {
  classification: CapabilityClass;
  kind: string;
  module: string;
  name: string;
}

const CONVEX_ROOT = dirname(fileURLToPath(import.meta.url));
const EXPECTED_CAPABILITY_HASH = "2bd77b1de51a71fe5ceaf09240439b32167c4606213f10b790585ae7a3baccfa";
const SOURCE_EXTENSION = /\.(?:js|ts)$/;
const NON_SOURCE_FILE = /(?:\.test|\.config)\.[jt]s$/;
const MODULE_EXTENSION = /\.[jt]s$/;
const CAPABILITY_DECLARATION =
  /export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(query|mutation|action|internalQuery|internalMutation|internalAction)\s*\(/g;

const ADMIN_ONLY_MODULES = new Set([
  "crm/leaveApprovers",
  "crm/leavePolicy",
  "crm/settings",
  "crm/staffImport",
  "crm/staffWorkbookUpdates",
]);

const AI_SERVER_ONLY_CAPABILITIES = new Set([
  "aiRuntime.consumeRateLimit",
  "aiRuntime.recordTelemetry",
]);

const PAYMENT_SERVER_ONLY_CAPABILITIES = new Set([
  "bookings.confirmBookingByOrderId",
  "bookings.markPaymentFailedByOrderId",
  "bookings.markRefundedByPaymentId",
  "bookings.recordPaymentAuthorized",
]);

const E2E_SERVER_ONLY_CAPABILITIES = new Set([
  "crm/e2eAssertions.travellerExists",
  "crm/e2eSeedActions.run",
]);

const SERVER_ONLY_CAPABILITIES = new Set([
  ...AI_SERVER_ONLY_CAPABILITIES,
  ...E2E_SERVER_ONLY_CAPABILITIES,
  ...PAYMENT_SERVER_ONLY_CAPABILITIES,
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    if (name === "_generated" || name === "node_modules") {
      return [];
    }
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    if (!SOURCE_EXTENSION.test(name) || NON_SOURCE_FILE.test(name)) {
      return [];
    }
    return [path];
  });
}

function classify(module: string, name: string, kind: string): CapabilityClass {
  if (kind.startsWith("internal")) {
    return "internal";
  }
  const identity = `${module}.${name}`;
  if (module === "migrations" || identity === "authSync.repairAuthLinks") {
    return "migration";
  }
  if (SERVER_ONLY_CAPABILITIES.has(identity)) {
    return "server-only";
  }
  if (ADMIN_ONLY_MODULES.has(module)) {
    return "admin-only";
  }
  return "public-product";
}

function discoverCapabilities(): Capability[] {
  return sourceFiles(CONVEX_ROOT)
    .flatMap((path) => {
      const module = relative(CONVEX_ROOT, path).split(sep).join("/").replace(MODULE_EXTENSION, "");
      const source = readFileSync(path, "utf8");
      return Array.from(source.matchAll(CAPABILITY_DECLARATION), (match) => ({
        classification: classify(module, match[1], match[2]),
        kind: match[2],
        module,
        name: match[1],
      }));
    })
    .sort((left, right) =>
      `${left.module}.${left.name}`.localeCompare(`${right.module}.${right.name}`)
    );
}

function capabilityHash(capabilities: Capability[]) {
  const snapshot = capabilities
    .map(({ classification, kind, module, name }) => `${module}.${name}:${kind}:${classification}`)
    .join("\n");
  return createHash("sha256").update(snapshot).digest("hex");
}

describe("Convex capability inventory", () => {
  test("every registered backend function is classified by the reviewed snapshot", () => {
    const capabilities = discoverCapabilities();
    expect(capabilities.length).toBeGreaterThan(200);
    expect(capabilityHash(capabilities)).toBe(EXPECTED_CAPABILITY_HASH);
  });

  test("distinguishes public, server, internal, admin, and migration capabilities", () => {
    const classes = new Set(discoverCapabilities().map((entry) => entry.classification));
    expect(classes).toEqual(
      new Set<CapabilityClass>([
        "admin-only",
        "internal",
        "migration",
        "public-product",
        "server-only",
      ])
    );
  });

  test("server-only payment writers retain the secret guard", () => {
    const source = readFileSync(join(CONVEX_ROOT, "bookings.ts"), "utf8");
    for (const name of PAYMENT_SERVER_ONLY_CAPABILITIES) {
      expect(source).toContain(`export const ${name.split(".")[1]} = mutation`);
    }
    expect(source.match(/assertPaymentMutationSecret\(args\.serverSecret\)/g)).toHaveLength(4);
  });

  test("server-only AI runtime writers retain their secret guard", () => {
    const source = readFileSync(join(CONVEX_ROOT, "aiRuntime.ts"), "utf8");
    expect(source.match(/assertRuntimeSecret\(args\.secret\)/g)).toHaveLength(2);
  });

  test("server-only E2E endpoints retain their secret guard", () => {
    const assertions = readFileSync(join(CONVEX_ROOT, "crm/e2eAssertions.ts"), "utf8");
    const seed = readFileSync(join(CONVEX_ROOT, "crm/e2eSeedActions.ts"), "utf8");
    expect(assertions).toContain("assertE2eSecret(args.secret)");
    expect(seed).toContain("assertE2eSecret(args.secret)");
  });
});
