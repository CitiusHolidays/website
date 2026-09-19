import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { getTrailsForHub, groupTrailsForHub, TRAILS } from "@/data/trails";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/pilgrimage",
});
let createRoot;
let PilgrimageTrailPageClient;
let PilgrimageRouteFitSelector;
let SpiritualTrailsHub;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.SVGElement = dom.window.SVGElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = clearTimeout;
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  dom.window.matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    matches: query.includes("prefers-reduced-motion"),
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  globalThis.matchMedia = dom.window.matchMedia;
  ({ createRoot } = await import("react-dom/client"));
  ({ default: PilgrimageTrailPageClient } = await import(
    "../../app/(public)/pilgrimage/[slug]/page.client"
  ));
  ({ default: PilgrimageRouteFitSelector } = await import("./PilgrimageRouteFitSelector"));
  ({ default: SpiritualTrailsHub } = await import("./SpiritualTrailsHub"));
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, root };
}

async function openSection(container, label) {
  const button = [...container.querySelectorAll("button[aria-controls]")].find(
    (candidate) => candidate.textContent === label
  );
  expect(button).toBeDefined();
  button.focus();
  await act(async () => button.click());
  expect(document.activeElement).toBe(button);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  const content = document.getElementById(button.getAttribute("aria-controls"));
  expect(content.textContent || content.querySelector("img")).toBeTruthy();
  expect(container.querySelectorAll('button[aria-controls][aria-pressed="true"]')).toHaveLength(1);
  return content;
}

describe("Pilgrimage programme presentation", () => {
  test("Offers one two-programme comparison and six forthcoming links with exact enquiry context", async () => {
    const { container, root } = await mount(
      <>
        <PilgrimageRouteFitSelector />
        <SpiritualTrailsHub groups={groupTrailsForHub(getTrailsForHub())} />
      </>
    );
    const programmes = container.querySelectorAll('input[type="radio"]');
    expect(programmes).toHaveLength(2);
    const forthcoming = container.querySelector("#all-trails");
    expect([...forthcoming.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual(
      TRAILS.filter((trail) => trail.status === "comingSoon").map(
        (trail) => `/pilgrimage/${trail.slug}`
      )
    );
    const selectProgramme = async (programme) => {
      programme.focus();
      await act(async () => programme.click());
      const result = container.querySelector('[role="status"]');
      expect(result.querySelector('a[href^="/pilgrimage/"]').getAttribute("href")).toBe(
        `/pilgrimage/${programme.value}`
      );
      const enquiry = result.querySelector('a[href^="/contact"]');
      expect(enquiry.textContent).toBe("Enquire");
      expect(enquiry.getAttribute("href")).toBe(
        `/contact?intent=pilgrimage-enquiry&trail=${programme.value}`
      );
    };
    await selectProgramme(programmes[0]);
    await selectProgramme(programmes[1]);
    await act(async () => root.unmount());
  });

  test.each(TRAILS.map((trail) => [trail.slug, trail]))(
    "%s keeps its introduction truthful, known facts visible and enquiry consistent",
    async (_slug, trail) => {
      const { container, root } = await mount(<PilgrimageTrailPageClient trail={trail} />);
      expect(container.querySelector("h1").textContent).toBe(trail.title);
      const hero = container.querySelector("section");
      expect(hero.textContent).toContain(trail.quickFacts.route);
      expect(hero.querySelector('a[href^="/contact"]').textContent).toBe("Enquire");
      expect(container.textContent.split("Coming soon.").length - 1).toBe(
        trail.status === "comingSoon" ? 1 : 0
      );
      if (trail.status === "comingSoon") {
        expect(hero.textContent).toContain("booking is not open");
      } else {
        expect(hero.textContent).toContain(trail.quickFacts.duration);
        expect(hero.textContent).toContain(trail.quickFacts.groupSize);
        const callback = container.querySelector('a[href*="intent=pilgrimage-callback"]');
        expect(callback.getAttribute("href")).toBe(
          `/contact?intent=pilgrimage-callback&trail=${trail.slug}`
        );
      }
      const enquiry = await openSection(container, "Enquiry");
      expect(enquiry.querySelectorAll("a")).toHaveLength(1);
      expect(enquiry.querySelector("a").getAttribute("href")).toBe(
        `/contact?intent=pilgrimage-enquiry&trail=${trail.slug}`
      );
      expect(enquiry.querySelector("a").textContent).toContain("Enquire");
      await act(async () => root.unmount());
      container.remove();
    }
  );

  test.each(
    TRAILS.filter((trail) => trail.status === "published").map((trail) => [trail.slug, trail])
  )("%s opens every section without losing itinerary or conditions", async (_slug, trail) => {
    const { container, root } = await mount(<PilgrimageTrailPageClient trail={trail} />);
    await openSection(container, "Overview");
    await openSection(container, "Gallery");
    await openSection(container, "Highlights");
    const itinerary = await openSection(container, "Itinerary");
    for (const day of trail.itinerary) {
      expect(itinerary.textContent).toContain(day.title);
      expect(itinerary.textContent).toContain(day.desc);
    }
    await openSection(container, "Package");
    const conditions = await openSection(container, "Conditions");
    for (const condition of trail.info.eligibility) {
      expect(conditions.textContent).toContain(condition);
    }
    await openSection(container, "Enquiry");
    await openSection(container, "Reviews");
    await act(async () => root.unmount());
    container.remove();
  });
});
