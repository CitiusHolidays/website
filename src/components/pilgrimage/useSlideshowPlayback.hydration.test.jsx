import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";

let reducedMotionPreference = false;

mock.module("motion/react", () => ({
  useReducedMotion: () => reducedMotionPreference,
}));

const { useSlideshowPlayback } = await import("./useSlideshowPlayback");

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/pilgrimage",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
});

afterAll(() => dom.window.close());

function PlaybackControl() {
  const { isPlaying, sectionRef, togglePlayback } = useSlideshowPlayback({
    intervalMs: 6000,
    itemCount: 4,
    onAdvance: () => undefined,
  });

  return (
    <section ref={sectionRef}>
      <button aria-pressed={isPlaying} onClick={togglePlayback} type="button">
        {isPlaying ? "Pause slideshow" : "Play slideshow"}
      </button>
    </section>
  );
}

describe("Slideshow playback hydration", () => {
  test("Hydrates a reduced-motion client without recovering the server tree", async () => {
    reducedMotionPreference = false;
    const container = document.createElement("div");
    container.innerHTML = renderToString(<PlaybackControl />);
    document.body.append(container);
    expect(container.textContent).toContain("Pause slideshow");

    reducedMotionPreference = true;
    const recoverableErrors = [];
    let root;

    await act(() => {
      root = hydrateRoot(container, <PlaybackControl />, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
    });

    expect(recoverableErrors).toEqual([]);
    expect(container.textContent).toContain("Play slideshow");
    expect(container.querySelector("button")?.getAttribute("aria-pressed")).toBe("false");

    await act(() => root.unmount());
    container.remove();
  });
});
