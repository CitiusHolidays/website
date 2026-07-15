import { describe, expect, test } from "bun:test";
import { file } from "bun";

const PORTAL_SHELL_BLOCK = /\.portal-shell\s*\{[^}]+--portal-toolbar-height:[^}]+\}/s;
const BODY_BLOCK = /body\s*\{[^}]+\}/s;

describe("TypeScript-first portal boundary", () => {
  test("configures generated shared UI as TSX and keeps the hot Pipeline seam typed", async () => {
    const components = await file("components.json").json();
    expect(components.tsx).toBeTrue();
    expect(await file("src/components/portal/pipeline/PipelineView.tsx").exists()).toBeTrue();
    expect(await file("src/components/portal/pipeline/PipelineView.js").exists()).toBeFalse();
  });

  test("scopes portal tokens and font smoothing to the portal root", async () => {
    const css = await file("src/app/globals.css").text();
    const portalBlock = css.match(PORTAL_SHELL_BLOCK)?.[0];
    expect(portalBlock).toContain("--portal-toolbar-height");
    expect(portalBlock).toContain("-webkit-font-smoothing: antialiased");
    const bodyBlock = css.match(BODY_BLOCK)?.[0];
    expect(bodyBlock).not.toContain("font-smoothing");
  });
});
