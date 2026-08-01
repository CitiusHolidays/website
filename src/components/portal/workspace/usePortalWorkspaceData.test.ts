import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const DATA_HOOK_FILE = "src/components/portal/workspace/usePortalWorkspaceData.ts";

function read(file: string) {
  return readFileSync(file, "utf8");
}

describe("usePortalWorkspaceData subscription gates", () => {
  test("loads search readiness only for supported non-empty search", () => {
    const source = read(DATA_HOOK_FILE);

    expect(source).toContain("shouldLoadSearchReadiness");
    expect(source).toContain("isSearchableListView");
    expect(source).toMatch(
      /shouldLoadSearchReadiness\s*\?\s*\{\s*referenceNow\s*\}\s*:\s*"skip"/
    );
    expect(source).not.toMatch(
      /useQuery\(\s*api\.crm\.listSearch\.getReadiness,\s*canFetch\s*\?\s*\{\s*referenceNow/
    );
  });

  test("loads extended notification history only when activity dependency is active", () => {
    const source = read(DATA_HOOK_FILE);

    expect(source).toMatch(
      /canFetch\s*&&\s*needs\("activity"\)\s*\?\s*\{\s*limit:\s*80\s*\}\s*:\s*"skip"/
    );
    expect(source).not.toMatch(
      /useQuery\(\s*api\.crm\.activity\.listNotifications,\s*canFetch\s*\?\s*\{\s*limit:\s*80/
    );
  });

  test("keeps portal chrome notification subscriptions in PortalShell", () => {
    const shell = read("src/components/portal/PortalShell.tsx");

    expect(shell).toMatch(
      /api\.crm\.activity\.listNotifications,\s*isAuthenticated && access\.allowed \? \{ limit: 8 \}/
    );
    expect(shell).toContain("api.crm.activity.notificationSummary");
  });
});
