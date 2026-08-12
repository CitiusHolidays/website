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

  test("keeps automatic and manual selection motionless", () => {
    expect(source).not.toContain('from "motion/react"');
    expect(source).not.toContain("useMotionUITheme");
    expect(source).not.toContain("useMotionUITransition");
    expect(source).toContain("selected ? (");
    expect(source).not.toContain("layoutId=");
    expect(source).not.toContain("portal-tabs-indicator-");
    expect(source).not.toContain("transition-[filter,opacity,transform]");
    expect(source).not.toContain("transitionDuration:");
    expect(source).not.toContain("<m.");
  });
});
