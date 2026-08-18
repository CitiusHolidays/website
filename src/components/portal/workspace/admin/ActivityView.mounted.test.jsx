import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { EmailDeliveryStatusRegion } from "./ActivityView";

const dom = new JSDOM("<!doctype html><html><body></body></html>");

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
});

afterAll(() => dom.window.close());

async function render(element) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, root };
}

describe("Activity email delivery visibility", () => {
  test("Renders privacy-safe retry and exhausted summaries", async () => {
    const mounted = await render(
      <EmailDeliveryStatusRegion
        coverage="complete"
        summaries={[
          {
            eventId: "notification_1",
            exhausted: 1,
            origin: { href: "/portal/queries?open=query&id=query_1", label: "Query submitted" },
            queued: 0,
            retrying: 2,
            sending: 0,
            sent: 4,
            skipped: 1,
            total: 8,
            updatedAt: Date.UTC(2026, 7, 8),
          },
        ]}
      />
    );

    expect(mounted.container.textContent).toContain("4 sent");
    expect(mounted.container.textContent).toContain("8 total");
    expect(mounted.container.textContent).toContain("2 retrying");
    expect(mounted.container.textContent).toContain("1 exhausted");
    expect(mounted.container.textContent).not.toContain("@");
    expect(mounted.container.querySelector("a")?.getAttribute("href")).toBe(
      "/portal/queries?open=query&id=query_1"
    );
    await act(async () => mounted.root.unmount());
  });

  test("Renders a deterministic empty state", async () => {
    const mounted = await render(<EmailDeliveryStatusRegion coverage="complete" summaries={[]} />);
    expect(mounted.container.textContent).toContain("No email delivery events yet");
    await act(async () => mounted.root.unmount());
  });

  test("Labels legacy and interrupted reconciliation totals as partial", async () => {
    const mounted = await render(
      <EmailDeliveryStatusRegion
        coverage="partial"
        summaries={[
          {
            eventId: "notification_501",
            exhausted: 0,
            queued: 0,
            retrying: 0,
            sending: 0,
            sent: 501,
            skipped: 0,
            total: 501,
            updatedAt: Date.UTC(2026, 7, 8),
          },
        ]}
      />
    );
    expect(mounted.container.textContent).toContain("Counts shown are partial");
    expect(mounted.container.textContent).toContain("501 currently counted");
    expect(mounted.container.textContent).not.toContain("501 total");
    await act(async () => mounted.root.unmount());
  });
});
