import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { getAccessibleNavGroups } from "@/lib/portal/permissions";
import { canAccessPortalRoute } from "@/lib/portal/portalRouteManifest";
import { PortalAccessProvider, usePortalServerAccess } from "./PortalAccessContext";

const dom = new JSDOM("<!doctype html><html><body></body></html>");

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
});

afterAll(() => dom.window.close());

function AccessProbe() {
  const access = usePortalServerAccess();
  return <output>{access?.allowed ? access.roles?.join(",") : "loading"}</output>;
}

describe("PortalAccessProvider", () => {
  test("Hydrates descendants from server-resolved access before a live query arrives", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <PortalAccessProvider access={{ allowed: true, roles: ["Sales"] }}>
          <AccessProbe />
        </PortalAccessProvider>
      );
    });

    expect(container.textContent).toBe("Sales");
    act(() => root.unmount());
  });
});

function EventAccessProbe() {
  const access = usePortalServerAccess();
  const eventPhotoBooth = access?.eventPhotoBooth;
  const allowed = canAccessPortalRoute({
    access,
    eventPhotoBooth,
    has: () => true,
    view: "event-photo-booth",
  });
  const visible = getAccessibleNavGroups(access, eventPhotoBooth).some((group) =>
    group.items.some((item) => item.page === "event-photo-booth")
  );
  return (
    <div>
      <output>{allowed ? "Editor allowed" : "Editor denied"}</output>
      {visible ? <a href="/portal/event-photo-booth">Event Photo Booth</a> : null}
    </div>
  );
}

test("Live event capability updates mounted navigation and route access together", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const access = { allowed: true, permissions: [], roles: ["Sales"] };
  const capability = {
    canManage: true,
    canManageAssignments: false,
    canParticipateWhenClosed: false,
  };
  const render = (eventPhotoBooth) =>
    act(() =>
      root.render(
        <PortalAccessProvider access={{ ...access, eventPhotoBooth }}>
          <EventAccessProbe />
        </PortalAccessProvider>
      )
    );
  render(undefined);
  expect(container.querySelector("a")).toBeNull();
  render(capability);
  expect(container.textContent).toContain("Editor allowed");
  expect(container.querySelector("a")?.getAttribute("href")).toBe("/portal/event-photo-booth");
  render({ ...capability, canManage: false });
  expect(container.textContent).toContain("Editor denied");
  expect(container.querySelector("a")).toBeNull();
  act(() => root.unmount());
});
