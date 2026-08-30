import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { act } from "react";

const TEAM_MEMBER_SOURCE = readFileSync("src/components/ui/TeamMember.js", "utf8");

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/about",
});

let createRoot;
let TeamMember;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  dom.window.matchMedia = () => ({
    addEventListener: () => undefined,
    matches: false,
    removeEventListener: () => undefined,
  });
  globalThis.matchMedia = dom.window.matchMedia;
  ({ createRoot } = await import("react-dom/client"));
  ({ default: TeamMember } = await import("./TeamMember"));
});

afterAll(() => dom.window.close());

describe("Mounted TeamMember disclosure", () => {
  test("Rapid toggles keep the accessible and visual state synchronized", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const member = {
      bio: "A deliberately long biography ".repeat(12),
      name: "Citius Leader",
      position: "Director",
      quote: "Travel should remain human.",
    };
    await act(async () => root.render(<TeamMember index={0} member={member} />));
    const button = container.querySelector('button[aria-expanded="false"]');
    expect(TEAM_MEMBER_SOURCE).not.toContain("ResizeObserver");
    expect(TEAM_MEMBER_SOURCE).not.toContain("transition-[height]");
    expect(button.textContent).toContain("Read More");
    await act(() => {
      button.click();
      button.click();
      button.click();
    });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.textContent).toContain("Show Less");
    expect(container.textContent).toContain("Travel should remain human.");
    await act(async () => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("Travel should remain human.");
    await act(async () => root.unmount());
    container.remove();
  });

  test("Short biographies remain complete without an unavailable disclosure", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <TeamMember
          index={0}
          member={{
            bio: "A complete biography that remains readable as text grows.",
            name: "Citius Guide",
            position: "Guide",
          }}
        />
      )
    );
    const biography = container.querySelector("p.text-brand-muted")?.parentElement;
    expect(biography?.className).toBe("relative");
    expect(container.querySelector("button[aria-expanded]")).toBeNull();
    await act(async () => root.unmount());
    container.remove();
  });
});
