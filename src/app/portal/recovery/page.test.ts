import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../..");
const readSource = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Recovery route module ownership", () => {
  test("enters its route-owned module without the global workspace renderer", () => {
    const page = readSource("src/app/portal/recovery/page.js");
    const routeModule = readSource(
      "src/components/portal/workspace/admin/RecoveryCenterModule.tsx"
    );

    expect(page).toContain("RecoveryCenterModule");
    expect(page).not.toContain("PortalWorkspace");
    expect(routeModule).toContain('usePortalWorkspaceShellState("recovery"');
    expect(routeModule).toContain("PortalWorkspaceFrame");
    expect(routeModule).toContain('import("./RecoveryCenterView")');
  });

  test("keeps one route query and one replay-safe action out of global switchboards", () => {
    const recoveryView = readSource("src/components/portal/workspace/admin/RecoveryCenterView.tsx");
    const lifecycle = readSource("src/components/portal/workspace/portalRouteLifecycle.tsx");
    const lazyViews = readSource("src/components/portal/workspace/portalLazyViews.tsx");
    const viewTypes = readSource("src/components/portal/workspace/portalViewTypes.ts");

    expect(recoveryView.match(/usePaginatedQuery\(/g)).toHaveLength(1);
    expect(recoveryView.match(/useAction\(/g)).toHaveLength(1);
    expect(lifecycle).not.toContain("RecoveryCenterView");
    expect(lazyViews).not.toContain("RecoveryCenterView");
    expect(viewTypes).not.toContain("RecoveryCenterViewProps");
  });
});
