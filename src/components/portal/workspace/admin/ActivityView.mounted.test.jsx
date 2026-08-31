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

  test("Does not claim an empty inbox while authorization coverage is partial", async () => {
    const mounted = await render(<EmailDeliveryStatusRegion coverage="partial" summaries={[]} />);
    expect(mounted.container.textContent).toContain("bounded, incomplete view");
    expect(mounted.container.textContent).not.toContain("No email delivery events yet");
    await act(async () => mounted.root.unmount());
  });

  test("filters and expands privacy-safe actionable one-event triage", async () => {
    const resent = [];
    const summaries = [
      {
        eventId: "notification_failed",
        exhausted: 1,
        origin: { href: "/portal/queries?id=failed", label: "Failed event" },
        queued: 0,
        retrying: 0,
        sending: 0,
        sent: 0,
        skipped: 0,
        total: 1,
        updatedAt: Date.UTC(2026, 7, 30),
      },
      {
        eventId: "notification_retrying",
        exhausted: 0,
        origin: { href: "/portal/queries?id=retrying", label: "Retrying event" },
        queued: 0,
        retrying: 1,
        sending: 0,
        sent: 0,
        skipped: 0,
        total: 1,
        updatedAt: Date.UTC(2026, 7, 30),
      },
    ];
    const triage = {
      attempts: { maximum: 4, minimum: 1 },
      canResend: true,
      causes: [
        {
          action: "Review provider and runtime health, then retry this event once.",
          code: "provider_unavailable",
          count: 1,
          kind: "provider",
        },
      ],
      coverage: "partial",
      eventId: "notification_failed",
      eventUpdatedAt: Date.UTC(2026, 7, 30),
      needsAttention: 1,
      resendReason: "Retry only the current failed recipients once.",
      statuses: {
        exhausted: 1,
        queued: 0,
        retrying: 0,
        sending: 0,
        sent: 0,
        skipped: 0,
      },
      target: {
        targetDeployment: "preview-email-health",
        targetEnvironment: "preview",
        targetRevision: "cb17abc",
      },
      window: {
        endedAt: Date.UTC(2026, 7, 30),
        startedAt: Date.UTC(2026, 7, 29),
      },
    };
    const mounted = await render(
      <EmailDeliveryStatusRegion
        coverage="complete"
        expandedEventId="notification_failed"
        onResend={(value) => resent.push(value.eventId)}
        onToggleEvent={() => undefined}
        summaries={summaries}
        triage={triage}
      />
    );
    expect(mounted.container.textContent).toContain("Privacy-safe event triage");
    expect(mounted.container.textContent).toContain("preview-email-health");
    expect(mounted.container.textContent).toContain("attempts 1–4");
    expect(mounted.container.textContent).toContain("provider unavailable");
    expect(mounted.container.textContent).toContain("Cause coverage is partial");
    expect(mounted.container.textContent).not.toContain("private.person@example.com");
    const retryButton = [...mounted.container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Retry failed recipients once")
    );
    await act(async () => retryButton.click());
    expect(resent).toEqual(["notification_failed"]);
    const retryingFilter = [...mounted.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Retrying"
    );
    await act(async () => retryingFilter.click());
    expect(mounted.container.textContent).toContain("Retrying event");
    expect(mounted.container.textContent).not.toContain("Failed event");
    expect(mounted.container.textContent).not.toContain("1 exhausted");
    await act(async () => mounted.root.unmount());
  });
});
