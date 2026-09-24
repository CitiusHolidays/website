import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { DEFAULT_BOOTH_SCENES } from "@/lib/eventPhotoBooth/contracts";
import { DEFAULT_TRANSFORM } from "@/lib/eventPhotoBooth/imageGeometry";
import type { useBoothEditor } from "./useBoothEditor";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
let useEditor: typeof useBoothEditor;
let createRoot: typeof import("react-dom/client").createRoot;
let failArtwork = false;
let heldArtwork: ((image: HTMLImageElement) => void) | null = null;
let holdArtwork = false;
let renderCount = 0;
const scenes = DEFAULT_BOOTH_SCENES.map((scene) => ({
  ...scene,
  artworkUrl: `/images/event-photo-booth/${scene.id}.webp`,
}));
const metrics = { flush: () => undefined, record: () => undefined };

beforeAll(async () => {
  Object.assign(globalThis, {
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
    window: dom.window,
  });
  Object.defineProperty(document, "fonts", { value: { ready: Promise.resolve() } });
  mock.module("@/lib/eventPhotoBooth/imageEngine", () => ({
    exportBoothPhoto: async () => new Blob(["ready photo"], { type: "image/png" }),
    loadBoothArtwork: () => {
      if (failArtwork) {
        return Promise.reject(new Error("Artwork unavailable"));
      }
      if (holdArtwork) {
        // Deliberately ignore AbortSignal: the editor must also reject late completions.
        return new Promise<HTMLImageElement>((resolve) => {
          heldArtwork = resolve;
        });
      }
      return Promise.resolve(document.createElement("img"));
    },
    loadSourcePhoto: async () => ({
      canvas: document.createElement("canvas"),
      height: 400,
      width: 300,
    }),
    releaseBoothPhoto: () => undefined,
    renderBoothPhoto: () => {
      renderCount += 1;
      return document.createElement("canvas");
    },
  }));
  ({ createRoot } = await import("react-dom/client"));
  ({ useBoothEditor: useEditor } = await import("./useBoothEditor"));
});
afterAll(() => {
  mock.restore();
  dom.window.close();
});
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 180));
  });

test("Failed and cancelled replacements preserve the original export and reject late artwork", async () => {
  let editor: ReturnType<typeof useBoothEditor> | undefined;
  function current() {
    if (!editor) {
      throw new Error("Editor has not mounted");
    }
    return editor;
  }
  const options: Parameters<typeof useBoothEditor>[0] = {
    canParticipate: true,
    format: "portrait",
    language: "en",
    metrics,
    mode: "frame",
    scene: scenes[0],
    transform: DEFAULT_TRANSFORM,
  };
  function Harness() {
    editor = useEditor(options);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(() => root.render(<Harness />));
  await act(() => current().selectPhoto(new File(["photo"], "photo.jpg")));
  await settle();
  const original = current().ready;
  expect(original?.destination).toBe("Paris");
  expect(original?.format).toBe("portrait");

  failArtwork = true;
  options.scene = scenes[3];
  options.format = "story";
  await act(() => root.render(<Harness />));
  await settle();
  expect(current().error).toBe("renderError");
  expect(current().ready).toBe(original);
  expect(current().previousResult).toBe(true);
  expect(current().busy).toBe(false);

  failArtwork = false;
  holdArtwork = true;
  options.scene = scenes[4];
  await act(() => root.render(<Harness />));
  await settle();
  expect(current().rendering).toBe(true);
  expect(current().busy).toBe(true);
  const beforeCancel = renderCount;
  await act(() => current().cancel());
  expect(current().busy).toBe(false);
  expect(current().rendering).toBe(false);
  expect(current().phase).toBe("cancelled");
  expect(current().ready).toBe(original);
  expect(current().hasPhoto).toBe(true);
  await act(() => {
    heldArtwork?.(document.createElement("img"));
  });
  expect(renderCount).toBe(beforeCancel);
  expect(current().ready).toBe(original);

  holdArtwork = false;
  await act(() => current().retryPreview());
  await settle();
  expect(current().ready?.destination).toBe("Ayodhya");
  expect(current().ready?.format).toBe("story");
  expect(current().previousResult).toBe(false);
  expect(current().ready?.file).not.toBe(original?.file);

  holdArtwork = true;
  options.scene = scenes[5];
  await act(() => root.render(<Harness />));
  await settle();
  await act(() => current().reset());
  await act(() => {
    heldArtwork?.(document.createElement("img"));
  });
  expect(current().ready).toBeNull();
  expect(current().hasPhoto).toBe(false);
  expect(current().busy).toBe(false);
  await act(() => root.unmount());
});
