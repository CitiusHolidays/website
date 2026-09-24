import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import {
  type BoothManagementState,
  type BoothSceneDraft,
  DEFAULT_BOOTH_SCENES,
  EMPTY_BOOTH_METRICS,
} from "@/lib/eventPhotoBooth/contracts";
import type { EventPhotoBoothEditorProps } from "./EventPhotoBoothEditor";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/event-photo-booth",
});
let Editor: typeof import("./EventPhotoBoothEditor").EventPhotoBoothEditor;
let createRoot: typeof import("react-dom/client").createRoot;
beforeAll(async () => {
  Object.assign(globalThis, {
    document: dom.window.document,
    Element: dom.window.Element,
    Event: dom.window.Event,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    MouseEvent: dom.window.MouseEvent,
    Node: dom.window.Node,
    window: dom.window,
  });
  ({ createRoot } = await import("react-dom/client"));
  ({ EventPhotoBoothEditor: Editor } = await import("./EventPhotoBoothEditor"));
});
afterAll(() => dom.window.close());
function management(canManageAssignments = false): BoothManagementState {
  const scenes = DEFAULT_BOOTH_SCENES.map((scene) => ({
    ...scene,
    artworkUrl: `/images/event-photo-booth/${scene.id}.webp`,
  }));
  return {
    availability: "closed",
    canManageAssignments,
    draftScenes: scenes,
    metrics: { ...EMPTY_BOOTH_METRICS },
    publishedScenes: scenes,
    revision: 0,
  };
}
async function mount(overrides: Partial<EventPhotoBoothEditorProps> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let props: EventPhotoBoothEditorProps = {
    loadMoreStaff: () => undefined,
    publishScenes: async () => 2,
    saveDraftScenes: async () => 1,
    setAvailability: async () => null,
    setStaffAssignment: async () => null,
    staff: [],
    staffStatus: "Exhausted",
    state: management(),
    uploadArtwork: async () => ({
      artwork: { key: "bali", kind: "bundled" },
      artworkUrl: "/bali.webp",
    }),
    ...overrides,
  };
  await act(async () => root.render(<Editor {...props} />));
  return {
    button: (label: string) => {
      const button = [...container.querySelectorAll("button")].find(
        (item) => item.textContent?.trim() === label || item.getAttribute("aria-label") === label
      );
      if (!button) {
        throw new Error(`Missing button: ${label}`);
      }
      return button;
    },
    container,
    rerender: async (updates: Partial<EventPhotoBoothEditorProps>) => {
      props = { ...props, ...updates };
      await act(async () => root.render(<Editor {...props} />));
    },
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}
async function enterEnglishName(container: HTMLElement, name: string) {
  const input = container.querySelector<HTMLInputElement>('input[maxlength="80"]');
  if (!input) {
    throw new Error("Missing English destination field");
  }
  await act(() => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")?.set?.call(
      input,
      name
    );
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
}
describe("Event Photo Booth staff editor", () => {
  test("saves draft fields without resolved artwork URLs and requires explicit publish", async () => {
    const saves: { expectedRevision: number; scenes: BoothSceneDraft[] }[] = [];
    const publishes: number[] = [];
    const view = await mount({
      publishScenes: ({ expectedRevision }) => {
        publishes.push(expectedRevision);
        return Promise.resolve(2);
      },
      saveDraftScenes: (args) => {
        saves.push(args);
        return Promise.resolve(1);
      },
    });
    try {
      await enterEnglishName(view.container, "Paris at sunset");
      expect(view.container.textContent).toContain("Unsaved changes");
      expect(view.button("Publish scenes").disabled).toBe(true);
      await act(async () => view.button("Save draft").click());
      expect(saves).toHaveLength(1);
      expect(saves[0].expectedRevision).toBe(0);
      expect(saves[0].scenes[0].title.en).toBe("Paris at sunset");
      expect(saves[0].scenes[0]).not.toHaveProperty("artworkUrl");
      expect(publishes).toHaveLength(0);
      await act(async () => view.button("Publish scenes").click());
      expect(publishes).toEqual([1]);
    } finally {
      await view.unmount();
    }
  });
  test("keeps edits after revision conflict and only discards them on explicit reload", async () => {
    const view = await mount({
      saveDraftScenes: () => Promise.reject(new Error("REVISION_CONFLICT")),
    });
    try {
      await enterEnglishName(view.container, "My unsaved Paris");
      await act(async () => view.button("Save draft").click());
      expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
        "Your edits are kept"
      );
      await view.rerender({ state: { ...management(), revision: 4 } });
      expect(view.container.querySelector<HTMLInputElement>('input[maxlength="80"]')?.value).toBe(
        "My unsaved Paris"
      );
      expect(view.button("Save draft").disabled).toBe(true);
      await act(async () => view.button("Discard my edits and load latest").click());
      expect(view.container.querySelector<HTMLInputElement>('input[maxlength="80"]')?.value).toBe(
        "Paris"
      );
    } finally {
      await view.unmount();
    }
  });
  test("opens and closes manually and excludes assignment controls for event operators", async () => {
    const availability: string[] = [];
    const view = await mount({
      setAvailability: (args) => {
        availability.push(args.availability);
        return Promise.resolve(null);
      },
    });
    try {
      expect(view.container.textContent).not.toContain("Event staff access");
      expect(view.container.querySelector('input[type="datetime-local"]')).toBeNull();
      await act(async () => view.button("Open event").click());
      await view.rerender({ state: { ...management(), availability: "open" } });
      await act(async () => view.button("Close event").click());
      expect(availability).toEqual(["open", "closed"]);
      expect(view.container.textContent).toContain("Share attempts");
      expect(view.container.textContent).toContain("not unique visitors");
    } finally {
      await view.unmount();
    }
  });
  test("allows authorized assignment changes and never grants inactive staff new access", async () => {
    const calls: { staffId: string; assigned: boolean }[] = [];
    const staff = [
      { active: true, assigned: false, id: "active", name: "Active Operator", roles: ["Sales"] },
      {
        active: false,
        assigned: false,
        id: "inactive",
        name: "Inactive Operator",
        roles: ["Sales"],
      },
      { active: false, assigned: true, id: "revokable", name: "Former Operator", roles: ["Sales"] },
    ];
    const view = await mount({
      setStaffAssignment: (args) => {
        calls.push(args);
        return Promise.resolve(null);
      },
      staff,
      state: management(true),
    });
    try {
      expect(view.button("Assign Inactive Operator").disabled).toBe(true);
      await act(async () => view.button("Assign Active Operator").click());
      await act(async () => view.button("Remove access for Former Operator").click());
      expect(calls).toEqual([
        { assigned: true, staffId: "active" },
        { assigned: false, staffId: "revokable" },
      ]);
      await view.rerender({ state: management(false) });
      expect(view.container.textContent).not.toContain("Event staff access");
    } finally {
      await view.unmount();
    }
  });
  test("reorders and hides scenes without publishing them", async () => {
    const saves: BoothSceneDraft[][] = [];
    const view = await mount({
      saveDraftScenes: ({ scenes }) => {
        saves.push(scenes);
        return Promise.resolve(1);
      },
    });
    try {
      await act(async () => view.button("Move scene down").click());
      await act(async () =>
        view.container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click()
      );
      await act(async () => view.button("Save draft").click());
      expect(saves[0][0].id).toBe("bali");
      expect(saves[0][1].id).toBe("paris");
      expect(saves[0][1].visible).toBe(false);
    } finally {
      await view.unmount();
    }
  });
});
