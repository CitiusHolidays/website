import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

let createRoot;
let OperationalControlCatalog;
let OperationalControlPlaneBanner;
let ScopeTooltip;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/settings",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  ({ createRoot } = await import("react-dom/client"));
  ({ OperationalControlCatalog, OperationalControlPlaneBanner, ScopeTooltip } = await import(
    "./OperationalControlPanelSections"
  ));
});

afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    rerender: async (nextElement) => act(async () => root.render(nextElement)),
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const preparedStatus = {
  active: false,
  blockingKeys: [],
  ready: true,
  revision: 4,
  willInitializeKeys: ["email.auth", "inbound.crm_intake"],
};
const noop = () => undefined;

function PreparedBanner({ reason }) {
  return (
    <OperationalControlPlaneBanner
      activationPending={false}
      activationReason={reason}
      onActivate={noop}
      onActivationReasonChange={noop}
      status={preparedStatus}
    />
  );
}

describe("Mounted operational control sections", () => {
  test("requires a reason for the one-way control-plane activation", async () => {
    const banner = await mount(<PreparedBanner reason="short" />);
    const activationButton = [...banner.container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Activate control plane once")
    );

    expect(banner.container.textContent).toContain("Control plane prepared");
    expect(banner.container.textContent).toContain("email.auth, inbound.crm_intake");
    expect(activationButton.disabled).toBe(true);
    expect(activationButton.className).toContain("min-h-11");

    await banner.rerender(<PreparedBanner reason="Reviewed Production activation" />);
    expect(activationButton.disabled).toBe(false);
    await banner.unmount();
  });

  test("presents active control-plane activation as permanent", async () => {
    const banner = await mount(
      <OperationalControlPlaneBanner
        activationPending={false}
        activationReason=""
        onActivate={noop}
        onActivationReasonChange={noop}
        status={{
          activatedAt: Date.UTC(2026, 7, 19, 12),
          activatedByName: "Asha Admin",
          active: true,
          blockingKeys: [],
          ready: true,
          revision: 5,
          willInitializeKeys: [],
        }}
      />
    );

    expect(banner.container.textContent).toContain("Activated by Asha Admin");
    expect(banner.container.textContent).toContain("Activation is permanent");
    expect(banner.container.querySelector('input[placeholder*="permanent"]')).toBeNull();
    await banner.unmount();
  });

  test("keeps the safe default expiry and all compact controls at a 44px target", async () => {
    const catalog = await mount(
      <OperationalControlCatalog
        active
        duration="2h"
        globalReason="Reviewed control change"
        groupedControls={[
          [
            "Contact",
            [
              {
                availability: "available",
                category: "Contact",
                dependencies: [],
                description: "Persists the public contact form in the CRM.",
                effectiveEnabled: true,
                enforcement: "inbound intent intake",
                key: "inbound.crm_intake",
                label: "CRM intake",
                revision: 3,
                source: "operational control",
                standardEnabled: true,
                state: "enabled",
              },
            ],
          ],
        ]}
        onControlChange={noop}
        onDurationChange={noop}
        onReasonChange={noop}
        pendingControl={null}
      />
    );
    const options = [...catalog.container.querySelectorAll("option")];
    const reset = [...catalog.container.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "Reset"
    );
    const controlSwitch = catalog.container.querySelector('[role="switch"]');

    expect(catalog.container.querySelector("select").value).toBe("2h");
    expect(options.at(-1).textContent).toBe("No expiry");
    expect(reset.className).toContain("min-h-11");
    expect(controlSwitch.className).toContain("h-11");
    await catalog.unmount();

    const tooltip = await mount(<ScopeTooltip kind="global" />);
    const tooltipButton = tooltip.container.querySelector("button");
    expect(tooltipButton.className).toContain("size-11");
    expect(tooltipButton.getAttribute("aria-label")).toBe("Explain global operational controls");
    await tooltip.unmount();
  });

  test("labels prepared control values as their activation-time resolution", async () => {
    const catalog = await mount(
      <OperationalControlCatalog
        active={false}
        duration="2h"
        globalReason=""
        groupedControls={[
          [
            "AI",
            [
              {
                availability: "available",
                category: "AI",
                dependencies: [],
                description: "Public concierge availability.",
                effectiveEnabled: false,
                enforcement: "concierge route",
                key: "ai.concierge",
                label: "AI concierge",
                revision: 0,
                source: "standard behavior",
                standardEnabled: false,
                state: "default",
              },
            ],
          ],
        ]}
        onControlChange={noop}
        onDurationChange={noop}
        onReasonChange={noop}
        pendingControl={null}
      />
    );

    expect(catalog.container.textContent).toContain("At activation: Off");
    expect(catalog.container.querySelector('[role="switch"]').disabled).toBe(true);
    await catalog.unmount();
  });
});
