import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { JSDOM } from "jsdom";
import { act } from "react";
import { getPermissionsForRoles } from "@/lib/portal/permissions";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citius.test/portal/travellers?jc=job-two",
});
const noop = () => undefined;
const calls = [];
let resolveSave;
let rejectSave;
let model;
const jobs = [
  { clientName: "Alpha", id: "job-one", jobCode: "JC-001" },
  { clientName: "Bravo", id: "job-two", jobCode: "JC-002", travelStartDate: "2026-11-03" },
];

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "Element",
    "Node",
    "Event",
    "MutationObserver",
  ]) {
    globalThis[key] = key === "window" ? dom.window : dom.window[key];
  }
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = clearTimeout;
  mock.module("next/navigation", () => ({
    usePathname: () => "/portal/travellers",
    useRouter: () => ({ prefetch: noop, push: noop, replace: noop }),
  }));
  mock.module("convex/react", () => ({
    useAction: () => async () => undefined,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    useMutation: (reference) => (args) => {
      calls.push({ args, name: getFunctionName(reference) });
      return new Promise((resolve, reject) => {
        resolveSave = resolve;
        rejectSave = reject;
      });
    },
    usePaginatedQuery: (reference, args) => ({
      loadMore: noop,
      results:
        args !== "skip" && getFunctionName(reference) === "crm/jobCards:listPage" ? jobs : [],
      status: "Exhausted",
    }),
    useQuery: () => undefined,
  }));
});
afterAll(() => {
  mock.restore();
  dom.window.close();
});

async function mount() {
  calls.length = 0;
  const { createRoot } = await import("react-dom/client");
  const { PortalAccessProvider } = await import("../PortalAccessContext");
  const { PortalToastProvider } = await import("../PortalToast");
  const { PortalConfirmProvider } = await import("../PortalConfirmDialog");
  const { usePortalWorkspaceState } = await import("../usePortalWorkspaceState");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  function Workspace() {
    model = usePortalWorkspaceState("travellers", new URLSearchParams(window.location.search));
    return null;
  }
  await act(async () =>
    root.render(
      <PortalAccessProvider
        access={{ allowed: true, permissions: getPermissionsForRoles(["Admin"]), roles: ["Admin"] }}
      >
        <PortalToastProvider>
          <PortalConfirmProvider>
            <Workspace />
          </PortalConfirmProvider>
        </PortalToastProvider>
      </PortalAccessProvider>
    )
  );
  return async () => {
    await act(async () => root.unmount());
    container.remove();
  };
}
const event = () => ({ preventDefault: noop });

test("Uses the current Job Card and sends one command through pending and saved feedback", async () => {
  const cleanup = await mount();
  await act(async () => model.chrome.header.openModal("traveller", { fullName: "Avery Rao" }));
  expect(model.modal.form.jobCardId).toBe("job-two");
  expect(model.modal.form.travelDate).toBe("2026-11-03");
  let pending;
  await act(() => {
    pending = model.modal.submit(event());
    model.modal.submit(event());
  });
  expect(calls).toHaveLength(1);
  expect(calls[0].name).toBe("crm/travellers:create");
  expect(calls[0].args).toMatchObject({ fullName: "Avery Rao", jobCardId: "job-two" });
  await act(() => {
    model.modal.closeModal();
    model.modal.updateForm("fullName", "Late edit");
    model.chrome.header.openModal("pnr");
  });
  expect(model.modal.modal).toBe("traveller");
  expect(model.modal.form.fullName).toBe("Avery Rao");
  await act(async () => {
    resolveSave("saved-traveller");
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(model.modal.saveFlash).toBe(true);
  await act(() => {
    model.modal.submit(event());
    model.modal.closeModal();
  });
  expect(calls).toHaveLength(1);
  expect(model.modal.modal).toBe("traveller");
  await act(async () => pending);
  expect(model.modal.modal).toBeNull();
  await cleanup();
});

test("Retains the failed draft and permits an explicit corrected retry", async () => {
  const cleanup = await mount();
  await act(async () => model.chrome.header.openModal("traveller", { fullName: "Avery Rao" }));
  let pending;
  await act(() => {
    pending = model.modal.submit(event());
  });
  await act(async () => {
    rejectSave(new Error("Sample service unavailable"));
    await pending;
  });
  expect(model.modal.modal).toBe("traveller");
  expect(model.modal.form.fullName).toBe("Avery Rao");
  expect(model.modal.error).toBe("Sample service unavailable");
  expect(model.modal.isSaving).toBe(false);
  await act(async () => model.modal.updateForm("fullName", "Avery Rao corrected"));
  await act(() => {
    pending = model.modal.submit(event());
  });
  expect(calls).toHaveLength(2);
  expect(calls[1].args).toMatchObject({ fullName: "Avery Rao corrected", jobCardId: "job-two" });
  await act(async () => {
    resolveSave("saved-traveller");
    await pending;
  });
  expect(model.modal.modal).toBeNull();
  await cleanup();
});
