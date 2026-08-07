import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/portal/PortalTabs.tsx", "utf8");

describe("PortalTabs Base UI behavior boundary", () => {
  test("delegates tab semantics to every Base UI Tabs part", () => {
    expect(source).toContain('import { Tabs } from "@/components/ui/foundation/base"');
    expect(source).toContain("<Tabs.Root");
    expect(source).toContain("<Tabs.List");
    expect(source).toContain("<Tabs.Tab");
    expect(source).toContain("<Tabs.Panel");
  });

  test("keeps Motion visual-only and explicitly reduced-motion safe", () => {
    expect(source).toContain('motionMode === "full"');
    expect(source).toContain("layoutId=");
    expect(source).toContain("portal-tabs-indicator-");
    expect(source).toContain("transition={motionAllowed ? snapTransition : { duration: 0 }}");
    expect(source).toContain("transition-[filter,opacity,transform]");
    expect(source).toContain("transitionDuration:");
  });
});
