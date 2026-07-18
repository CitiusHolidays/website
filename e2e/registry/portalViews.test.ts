import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PORTAL_E2E_MATRIX } from "./portalViews";

const REGISTRY_FILE = join(process.cwd(), "src/components/portal/workspace/portalViewRegistry.tsx");

function extractViewIds(constantName: string) {
  const source = readFileSync(REGISTRY_FILE, "utf8");
  const match = source.match(
    new RegExp(`export const ${constantName} = \\[([\\s\\S]*?)\\] as const`)
  );
  expect(match).not.toBeNull();
  return [...match![1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

describe("portal e2e registry", () => {
  test("covers every portal view id from the app registry export list", () => {
    const viewIds = [
      ...extractViewIds("CORE_PORTAL_VIEW_IDS"),
      ...extractViewIds("PILOT_PORTAL_VIEW_IDS"),
      ...extractViewIds("OPERATIONS_PORTAL_VIEW_IDS"),
      ...extractViewIds("TICKETING_PORTAL_VIEW_IDS"),
      ...extractViewIds("ADMINISTRATION_PORTAL_VIEW_IDS"),
    ];
    expect(Object.keys(PORTAL_E2E_MATRIX).sort()).toEqual([...viewIds].sort());
  });
});
