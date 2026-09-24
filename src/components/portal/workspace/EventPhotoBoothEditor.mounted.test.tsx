import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import type { Id } from "@convex/_generated/dataModel";
import { ConvexError } from "convex/values";
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
async function choose(container: HTMLElement, label: string, value: string) {
  const select = [...container.querySelectorAll("label")]
    .find((item) => item.textContent?.trim().startsWith(label))
    ?.querySelector("select");
  if (!select) {
    throw new Error(`Missing select: ${label}`);
  }
  await act(() => {
    select.value = value;
    select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
}
async function applyTemplate(view: Awaited<ReturnType<typeof mount>>, templateId: string) {
  await act(async () => view.button("Choose destination template").click());
  await choose(view.container, "Destination template", templateId);
  await act(async () => view.button("Apply template").click());
}
function destinationFields(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLInputElement>("input[maxlength]")].map(
    (input) => input.value
  );
}
describe("Event Photo Booth staff editor", () => {
  test("browses scenes without changing order or dirty state, including hidden scenes", async () => {
    const state = management();
    state.draftScenes[1] = { ...state.draftScenes[1], visible: false };
    state.publishedScenes = state.draftScenes;
    const saves: BoothSceneDraft[][] = [];
    const view = await mount({
      saveDraftScenes: ({ scenes }) => {
        saves.push(scenes);
        return Promise.resolve(1);
      },
      state,
    });
    try {
      expect(view.button("Previous scene").disabled).toBe(true);
      await act(async () => view.button("Next scene").click());
      expect(destinationFields(view.container)[0]).toBe("Bali");
      expect(view.container.textContent).toContain("Scene 2 of 6");
      expect(view.button("Save draft").disabled).toBe(true);
      expect(
        view.container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked
      ).toBe(false);
      await enterEnglishName(view.container, "Bali evening");
      await act(async () => view.button("Previous scene").click());
      expect(destinationFields(view.container)[0]).toBe("Paris");
      await act(async () => view.button("Next scene").click());
      expect(destinationFields(view.container)[0]).toBe("Bali evening");
      await choose(view.container, "Edit scene", "kedarnath");
      expect(view.button("Next scene").disabled).toBe(true);
      await act(async () => view.button("Save draft").click());
      expect(saves[0].map((scene) => scene.id)).toEqual(
        DEFAULT_BOOTH_SCENES.map((scene) => scene.id)
      );
      expect(saves[0][1].title.en).toBe("Bali evening");
    } finally {
      await view.unmount();
    }
  });
  test("template browsing, Enter and cancellation cannot add, apply or save scenes", async () => {
    let saves = 0;
    const view = await mount({
      saveDraftScenes: () => {
        saves += 1;
        return Promise.resolve(1);
      },
    });
    try {
      await act(async () => view.button("Add scene").click());
      expect(view.button("Add selected scene").disabled).toBe(true);
      await choose(view.container, "Destination template", "kashi");
      const select = view.container.querySelector('select[aria-label="Destination template"]');
      const enter = new dom.window.KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
      });
      await act(() => select?.dispatchEvent(enter));
      expect(enter.defaultPrevented).toBe(false);
      const submit = new dom.window.Event("submit", { bubbles: true, cancelable: true });
      await act(() => view.container.querySelector("form")?.dispatchEvent(submit));
      expect(submit.defaultPrevented).toBe(true);
      expect(destinationFields(view.container)[0]).toBe("Paris");
      expect(view.button("Save draft").disabled).toBe(true);
      expect(view.container.textContent).toContain("Scene 1 of 6");
      await act(async () => view.button("Cancel adding scene").click());
      expect(document.activeElement).toBe(view.button("Add scene"));
      await act(async () => view.button("Choose destination template").click());
      await choose(view.container, "Destination template", "bali");
      expect(destinationFields(view.container)[0]).toBe("Paris");
      await act(async () => view.button("Next scene").click());
      expect(view.container.querySelector('select[aria-label="Destination template"]')).toBeNull();
      await act(async () => view.button("Choose destination template").click());
      expect(view.button("Apply template").disabled).toBe(true);
      await act(async () => view.button("Cancel template change").click());
      expect(document.activeElement).toBe(view.button("Choose destination template"));
      expect(view.button("Save draft").disabled).toBe(true);
      expect(saves).toBe(0);
    } finally {
      await view.unmount();
    }
  });
  test("adds exactly one confirmed scene and enforces the 24-scene limit", async () => {
    const state = management();
    state.draftScenes = Array.from({ length: 23 }, (_, index) => ({
      ...state.draftScenes[0],
      id: `scene-${index}`,
    }));
    state.publishedScenes = state.draftScenes;
    const view = await mount({ state });
    try {
      await act(async () => view.button("Add scene").click());
      await choose(view.container, "Destination template", "ayodhya");
      const confirm = view.button("Add selected scene");
      await act(() => {
        confirm.click();
        confirm.click();
      });
      expect(view.container.textContent).toContain("Scene 24 of 24");
      expect(destinationFields(view.container)[0]).toBe("Ayodhya");
      expect(view.button("Add scene").disabled).toBe(true);
      expect(view.button("Next scene").disabled).toBe(true);
      expect(view.container.textContent).toContain("24-scene limit reached.");
      expect(document.activeElement).toBe(
        view.container.querySelector('select[aria-label="Edit scene"]')
      );
    } finally {
      await view.unmount();
    }
  });
  test("reordering the current server scene preserves selection after the old scene is removed", async () => {
    const view = await mount();
    try {
      const state = management();
      await view.rerender({
        state: { ...state, draftScenes: state.draftScenes.slice(1), revision: 3 },
      });
      expect(destinationFields(view.container)[0]).toBe("Bali");
      await choose(view.container, "Display order", "3");
      expect(destinationFields(view.container)[0]).toBe("Bali");
      expect(
        view.container.querySelector<HTMLSelectElement>('select[aria-label="Edit scene"]')?.value
      ).toBe("bali");
      expect(view.container.textContent).toContain("Scene 4 of 5");
    } finally {
      await view.unmount();
    }
  });
  test("a remote edit during upload retains the starting revision and requires conflict recovery", async () => {
    const engine = await import("@/lib/eventPhotoBooth/imageEngine");
    const canvas = document.createElement("canvas");
    canvas.toBlob = (callback) => callback(new Blob(["prepared image"], { type: "image/jpeg" }));
    const prepare = spyOn(engine, "loadSourcePhoto").mockResolvedValue({
      canvas,
      height: 100,
      width: 100,
    });
    let finishUpload:
      | ((result: Awaited<ReturnType<EventPhotoBoothEditorProps["uploadArtwork"]>>) => void)
      | undefined;
    const view = await mount({
      uploadArtwork: () =>
        new Promise((resolve) => {
          finishUpload = resolve;
        }),
    });
    try {
      const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) {
        throw new Error("Missing background upload");
      }
      Object.defineProperty(input, "files", {
        value: [new File(["image"], "scene.jpg", { type: "image/jpeg" })],
      });
      await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
      expect(view.container.textContent).toContain("Uploading background…");
      const state = management();
      state.draftScenes[0] = {
        ...state.draftScenes[0],
        title: { ...state.draftScenes[0].title, en: "Remote edited Paris" },
      };
      await view.rerender({ state: { ...state, revision: 1 } });
      await act(async () =>
        finishUpload?.({ artwork: { key: "bali", kind: "bundled" }, artworkUrl: "/bali.webp" })
      );
      expect(view.container.textContent).toContain("A newer draft is available");
      expect(view.button("Save draft").disabled).toBe(true);
      expect(destinationFields(view.container)[0]).toBe("Paris");
      await act(async () => view.button("Discard edits and reload").click());
      expect(destinationFields(view.container)[0]).toBe("Remote edited Paris");
      expect(view.container.querySelector("img")?.getAttribute("src")).toContain("paris-192.webp");
    } finally {
      prepare.mockRestore();
      await view.unmount();
    }
  });
  test("cancelled and invalid background uploads preserve artwork and draft fields", async () => {
    let uploads = 0;
    const view = await mount({
      uploadArtwork: () => {
        uploads += 1;
        throw new Error("Unexpected upload");
      },
    });
    try {
      const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) {
        throw new Error("Missing background upload");
      }
      await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
      expect(view.button("Save draft").disabled).toBe(true);
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [new File(["not an image"], "bad.txt", { type: "text/plain" })],
      });
      await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
      expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
        "JPG, PNG or WebP"
      );
      expect(destinationFields(view.container)[0]).toBe("Paris");
      expect(
        view.container.querySelector('img[alt="Current background for Paris"]')?.getAttribute("src")
      ).toContain("paris-192.webp");
      expect(view.button("Save draft").disabled).toBe(true);
      expect(input.value).toBe("");
      expect(uploads).toBe(0);
    } finally {
      await view.unmount();
    }
  });
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
  test("changes Paris to Kashi in both languages, category and the saved draft", async () => {
    const saves: BoothSceneDraft[][] = [];
    const view = await mount({
      saveDraftScenes: ({ scenes }) => {
        saves.push(scenes);
        return Promise.resolve(1);
      },
    });
    try {
      await applyTemplate(view, "kashi");
      expect(destinationFields(view.container)).toEqual([
        "Kashi",
        "काशी",
        "Uttar Pradesh, India",
        "उत्तर प्रदेश, भारत",
      ]);
      expect(view.button("Publish scenes").disabled).toBe(true);
      await act(async () => view.button("Save draft").click());
      expect(saves[0][0]).toMatchObject({
        artwork: { key: "kashi", kind: "bundled" },
        caption: { en: "Uttar Pradesh, India", hi: "उत्तर प्रदेश, भारत" },
        category: "pilgrimage",
        id: "paris",
        title: { en: "Kashi", hi: "काशी" },
      });
      expect(saves[0][0]).not.toHaveProperty("artworkUrl");
      await choose(view.container, "Edit scene", "bali");
      expect(destinationFields(view.container)[0]).toBe("Bali");
      await choose(view.container, "Edit scene", "paris");
      expect(destinationFields(view.container)[0]).toBe("Kashi");
    } finally {
      await view.unmount();
    }
  });
  test("repairs stock text from a saved artwork-only change and keeps custom text", async () => {
    const state = management();
    state.draftScenes[0] = {
      ...state.draftScenes[0],
      artwork: { key: "kashi", kind: "bundled" },
      artworkUrl: "/kashi.webp",
      caption: { en: "Our family trip", hi: "फ्रांस" },
      visible: false,
    };
    const view = await mount({ state });
    try {
      expect(destinationFields(view.container)[0]).toBe("Paris");
      await applyTemplate(view, "kashi");
      expect(destinationFields(view.container)).toEqual([
        "Kashi",
        "काशी",
        "Our family trip",
        "उत्तर प्रदेश, भारत",
      ]);
      expect(
        view.container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked
      ).toBe(false);
      expect(
        view.container.querySelector<HTMLSelectElement>('select[aria-label="Edit scene"]')?.value
      ).toBe("paris");
      await enterEnglishName(view.container, "A special destination");
      await applyTemplate(view, "ayodhya");
      expect(destinationFields(view.container)).toEqual([
        "A special destination",
        "अयोध्या",
        "Our family trip",
        "उत्तर प्रदेश, भारत",
      ]);
    } finally {
      await view.unmount();
    }
  });
  test("loads current server scenes and adds the chosen destination without assuming Paris", async () => {
    const state = management();
    state.draftScenes = [state.draftScenes[3]];
    const saves: BoothSceneDraft[][] = [];
    const view = await mount({
      saveDraftScenes: ({ scenes }) => {
        saves.push(scenes);
        return Promise.resolve(1);
      },
      state,
    });
    try {
      expect(destinationFields(view.container)[0]).toBe("Kashi");
      await act(async () => view.button("Add scene").click());
      await choose(view.container, "Destination template", "kedarnath");
      await act(async () => view.button("Add selected scene").click());
      expect(destinationFields(view.container)).toEqual([
        "Kedarnath",
        "केदारनाथ",
        "Uttarakhand, India",
        "उत्तराखंड, भारत",
      ]);
      await act(async () => view.button("Save draft").click());
      expect(saves[0]).toHaveLength(2);
      expect(saves[0][1]).toMatchObject({
        artwork: { key: "kedarnath", kind: "bundled" },
        category: "pilgrimage",
      });
      expect(saves[0][1].id).not.toBe("kashi");
      await view.rerender({
        state: { ...state, draftScenes: [state.publishedScenes[1]], revision: 5 },
      });
      expect(destinationFields(view.container)[0]).toBe("Bali");
    } finally {
      await view.unmount();
    }
  });
  test("selecting uploaded scenes preserves their artwork and custom metadata", async () => {
    const state = management();
    state.draftScenes[1] = {
      ...state.draftScenes[1],
      // SAFETY: Fixture-only ID never reaches the backend.
      artwork: { id: "custom" as Id<"eventPhotoBoothArtwork">, kind: "upload" },
      artworkUrl: "/custom.webp",
      caption: { en: "Beach day", hi: "समुद्र तट" },
      title: { en: "Goa", hi: "गोवा" },
    };
    const saves: BoothSceneDraft[][] = [];
    const view = await mount({
      saveDraftScenes: ({ scenes }) => {
        saves.push(scenes);
        return Promise.resolve(1);
      },
      state,
    });
    try {
      await choose(view.container, "Edit scene", "bali");
      expect(destinationFields(view.container)).toEqual(["Goa", "गोवा", "Beach day", "समुद्र तट"]);
      await enterEnglishName(view.container, "Goa evening");
      await choose(view.container, "Edit scene", "paris");
      await choose(view.container, "Edit scene", "bali");
      await act(async () => view.button("Save draft").click());
      expect(saves[0][1]).toMatchObject({
        artwork: { id: "custom", kind: "upload" },
        title: { en: "Goa evening", hi: "गोवा" },
      });
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
      await act(async () => view.button("Discard edits and reload").click());
      expect(view.container.querySelector<HTMLInputElement>('input[maxlength="80"]')?.value).toBe(
        "Paris"
      );
    } finally {
      await view.unmount();
    }
  });
  test("explains why the booth cannot open without losing the current draft", async () => {
    const view = await mount({
      setAvailability: () => Promise.reject(new ConvexError("NO_VISIBLE_SCENES")),
    });
    try {
      await enterEnglishName(view.container, "My draft");
      await act(async () => view.button("Open booth").click());
      expect(view.container.querySelector('[role="alert"]')?.textContent).toBe(
        "Show at least one scene and publish it before opening the booth."
      );
      expect(destinationFields(view.container)[0]).toBe("My draft");
      expect(view.button("Save draft").disabled).toBe(false);
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
      await act(async () => view.button("Open booth").click());
      await view.rerender({ state: { ...management(), availability: "open" } });
      await act(async () => view.button("Close booth").click());
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
      {
        active: true,
        assigned: false,
        // SAFETY: Controlled staff DTO IDs stay inside this editor fixture; no backend call is made.
        id: "active" as Id<"staffUsers">,
        name: "Active Operator",
        roles: ["Sales"],
      },
      {
        active: false,
        assigned: false,
        // SAFETY: Controlled staff DTO IDs stay inside this editor fixture; no backend call is made.
        id: "inactive" as Id<"staffUsers">,
        name: "Inactive Operator",
        roles: ["Sales"],
      },
      {
        active: false,
        assigned: true,
        // SAFETY: Controlled staff DTO IDs stay inside this editor fixture; no backend call is made.
        id: "revokable" as Id<"staffUsers">,
        name: "Former Operator",
        roles: ["Sales"],
      },
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
      expect(view.button("Give access to Inactive Operator").disabled).toBe(true);
      await act(async () => view.button("Give access to Active Operator").click());
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
      await choose(view.container, "Display order", "1");
      expect(destinationFields(view.container)[0]).toBe("Paris");
      expect(view.container.textContent).toContain("Scene 2 of 6");
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
