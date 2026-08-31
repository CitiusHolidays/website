import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useEffect } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
let createRoot;
let useAnimatedIconTrigger;
let finePointer = false;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.matchMedia = (query) => ({
    matches: finePointer && query === "(hover: hover) and (pointer: fine)",
    media: query,
  });
  ({ createRoot } = await import("react-dom/client"));
  ({ useAnimatedIconTrigger } = await import("./AnimatedLucideIcons"));
});

afterAll(() => dom.window.close());

function TriggerProbe({ firstRef, onReady, secondRef }) {
  const trigger = useAnimatedIconTrigger(firstRef, secondRef);
  useEffect(() => onReady(trigger), [onReady, trigger]);
  return null;
}

describe("Animated Lucide trigger coverage", () => {
  test("drives every icon only from a fine-pointer hit area", async () => {
    const calls = [];
    const refs = ["first", "second"].map((name) => ({
      current: {
        startAnimation: () => calls.push(`start:${name}`),
        stopAnimation: () => calls.push(`stop:${name}`),
      },
    }));
    let trigger;
    const receiveTrigger = (nextTrigger) => {
      trigger = nextTrigger;
    };
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () =>
      root.render(<TriggerProbe firstRef={refs[0]} onReady={receiveTrigger} secondRef={refs[1]} />)
    );

    expect(trigger.onFocus).toBeUndefined();
    trigger.onPointerEnter();
    expect(calls).toEqual([]);

    finePointer = true;
    trigger.onPointerEnter();
    trigger.onPointerLeave();

    expect(calls).toEqual(["start:first", "start:second", "stop:first", "stop:second"]);
    finePointer = false;
    await act(async () => root.unmount());
  });
});
