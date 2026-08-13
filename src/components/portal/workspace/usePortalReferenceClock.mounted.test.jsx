import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  localIsoDate,
  millisecondsUntilNextLocalDay,
  OPERATION_REFERENCE_TICK_MS,
  useActiveLocalReferenceDate,
  useActiveOperationReferenceNow,
} from "./usePortalReferenceClock";

const originalDateNow = Date.now;
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
});

afterEach(() => {
  Date.now = originalDateNow;
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  document.body.replaceChildren();
});

afterAll(() => dom.window.close());

function OperationClockProbe({ active }) {
  return <output>{useActiveOperationReferenceNow(active)}</output>;
}

function LocalDateProbe({ active }) {
  return <output>{useActiveLocalReferenceDate(active)}</output>;
}

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => root.render(element));
  return { container, root };
}

function outputValue(container) {
  return container.querySelector("output")?.textContent;
}

describe("portal reference clock ownership", () => {
  test("ticks only while an operation surface is active and cleans up on close", async () => {
    let referenceNow = 1_000_000;
    let nextId = 0;
    const intervals = new Map();
    Date.now = () => referenceNow;
    globalThis.setInterval = (callback, delay) => {
      expect(delay).toBe(OPERATION_REFERENCE_TICK_MS);
      nextId += 1;
      intervals.set(nextId, callback);
      return nextId;
    };
    globalThis.clearInterval = (id) => {
      intervals.delete(id);
    };

    const view = await mount(<OperationClockProbe active={false} />);
    expect(intervals.size).toBe(0);

    await act(() => view.root.render(<OperationClockProbe active />));
    expect(intervals.size).toBe(1);
    referenceNow += OPERATION_REFERENCE_TICK_MS;
    await act(async () => intervals.values().next().value?.());
    expect(outputValue(view.container)).toBe(String(referenceNow));

    await act(() => view.root.render(<OperationClockProbe active={false} />));
    expect(intervals.size).toBe(0);
    await act(() => view.root.unmount());
  });

  test("refreshes date-only inputs at the next local day and nowhere while inactive", async () => {
    let referenceNow = new Date(2026, 2, 31, 23, 59, 59, 900).getTime();
    let nextId = 0;
    const timeouts = new Map();
    Date.now = () => referenceNow;
    globalThis.setTimeout = (callback, delay) => {
      nextId += 1;
      timeouts.set(nextId, { callback, delay });
      return nextId;
    };
    globalThis.clearTimeout = (id) => {
      timeouts.delete(id);
    };

    const view = await mount(<LocalDateProbe active={false} />);
    expect(timeouts.size).toBe(0);
    expect(outputValue(view.container)).toBe("2026-03-31");

    await act(() => view.root.render(<LocalDateProbe active />));
    const [scheduledId, scheduled] = timeouts.entries().next().value ?? [];
    expect(scheduled?.delay).toBe(millisecondsUntilNextLocalDay(referenceNow));
    referenceNow += scheduled?.delay ?? 0;
    if (scheduledId !== undefined) {
      timeouts.delete(scheduledId);
    }
    await act(async () => scheduled?.callback());
    expect(outputValue(view.container)).toBe("2026-04-01");

    await act(() => view.root.render(<LocalDateProbe active={false} />));
    expect(timeouts.size).toBe(0);
    await act(() => view.root.unmount());
  });

  test("formats local date inputs without a zero-argument wall-clock read", () => {
    const referenceNow = new Date(2026, 7, 13, 12, 0, 0).getTime();
    expect(localIsoDate(referenceNow)).toBe("2026-08-13");
  });
});
