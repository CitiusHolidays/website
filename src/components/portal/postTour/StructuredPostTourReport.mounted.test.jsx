import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { emptyPostTourReport } from "@convex/lib/postTourReportContent";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citius.test",
});
let createRoot, PostTourReportForm, root;
const noSubmit = () => {
  throw new Error("Draft save must not submit");
};
beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  for (const name of [
    "window",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "HTMLSelectElement",
    "Element",
    "Node",
    "Event",
    "MouseEvent",
    "MutationObserver",
  ]) {
    globalThis[name] = dom.window[name] ?? dom.window;
  }
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  ({ createRoot } = await import("react-dom/client"));
  ({ PostTourReportForm } = await import("./StructuredPostTourReport"));
});
afterEach(async () => {
  if (root) {
    await act(() => root.unmount());
  }
  root = null;
  document.body.replaceChildren();
});
afterAll(() => dom.window.close());
function fixture(key) {
  return {
    archived: [],
    canPrepare: true,
    initial: emptyPostTourReport({
      client: "Synthetic group",
      destination: "Jaipur",
      endDate: "2026-10-04",
      guests: 20,
      startDate: "2026-10-01",
      tourManager: "Synthetic manager",
    }),
    jobCardId: `job-${key}`,
    jobCode: "JC-REPORT",
    report: null,
    viewerKey: key,
    viewerName: "Synthetic Operations",
  };
}
async function mount(workspace, onSaveDraft, extra = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() =>
    root.render(
      <PostTourReportForm
        onSaveDraft={onSaveDraft}
        onSubmitReport={noSubmit}
        report={null}
        viewerKey={workspace.viewerKey}
        workspace={workspace}
        {...extra}
      />
    )
  );
  return host;
}
function control(host, label) {
  return [...host.querySelectorAll("label")].find((row) => row.textContent.startsWith(label))
    ?.control;
}
function button(host, label) {
  return [...host.querySelectorAll("button")].find((row) => row.textContent === label);
}
async function fill(node, value) {
  await act(() => {
    const prototypes = {
      SELECT: dom.window.HTMLSelectElement.prototype,
      TEXTAREA: dom.window.HTMLTextAreaElement.prototype,
    };
    const proto = prototypes[node.tagName] ?? dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(node, value);
    node.dispatchEvent(
      new dom.window.Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true })
    );
  });
}
test("supplier 1–2 reveals only its required follow-up; good and N.A. ratings remove it", async () => {
  const host = await mount(fixture("supplier"), async () => ({ id: "report", revision: 1 }));
  expect(host.querySelectorAll('[data-report-section="4"] textarea')).toHaveLength(0);
  await fill(host.querySelector('[data-report-section="4"] select'), "2");
  expect(host.querySelectorAll('[data-report-section="4"] textarea')).toHaveLength(1);
  expect(host.querySelector('[data-report-section="4"] textarea').required).toBe(true);
  await fill(host.querySelector('[data-report-section="4"] select'), "4");
  expect(host.querySelectorAll('[data-report-section="4"] textarea')).toHaveLength(0);
  await fill(host.querySelector('[data-report-section="4"] select'), "na");
  expect(host.querySelectorAll('[data-report-section="4"] textarea')).toHaveLength(0);
});
test("failed save restores editing and keeps the exact draft, then retries using the same expected identity", async () => {
  const calls = [];
  const save = (args) => {
    calls.push(args);
    return Promise.reject(new Error("Synthetic save failure"));
  };
  const host = await mount(fixture("failure"), save);
  await fill(control(host, "Client / Company"), "Retain this changed client");
  await act(async () => {
    button(host, "Save draft").click();
    await Promise.resolve();
  });
  expect(control(host, "Client / Company").value).toBe("Retain this changed client");
  expect(control(host, "Client / Company").disabled).toBe(false);
  expect(host.querySelector('[role="alert"]').textContent).toContain("Synthetic save failure");
  await act(async () => {
    button(host, "Save draft").click();
    await Promise.resolve();
  });
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual(calls[0]);
});
test("pending save locks all fieldsets and duplicate clicks, without submitting", async () => {
  let resolve;
  let calls = 0;
  const save = () => {
    calls += 1;
    return new Promise((done) => {
      resolve = done;
    });
  };
  const host = await mount(fixture("pending"), save);
  await act(async () => {
    button(host, "Save draft").click();
    button(host, "Save draft").click();
    await Promise.resolve();
  });
  expect(calls).toBe(1);
  expect(host.querySelector("form > fieldset").disabled).toBe(true);
  expect(button(host, "Submit report").disabled).toBe(true);
  await act(async () => {
    resolve({ id: "report-pending", revision: 1 });
    await Promise.resolve();
  });
  expect(host.querySelector("form > fieldset").disabled).toBe(false);
  expect(host.querySelector('[role="status"]').textContent).toBe(
    "Draft saved. No submission alert has been sent."
  );
});
test("unsaved navigation draft is scoped to the same staff and Job Card", async () => {
  const workspace = fixture("navigation");
  let host = await mount(workspace, async () => ({ id: "report", revision: 1 }));
  await fill(control(host, "Client / Company"), "Private local draft");
  await act(() => root.unmount());
  root = null;
  host = await mount(workspace, async () => ({ id: "report", revision: 1 }));
  expect(control(host, "Client / Company").value).toBe("Private local draft");
  expect(
    [...host.querySelectorAll("label")].find(
      (row) => row.htmlFor === control(host, "Client / Company").id
    ).textContent
  ).toBe("Client / Company *");
  await act(() => root.unmount());
  root = null;
  host = await mount({ ...workspace, viewerKey: "different-staff" }, async () => ({
    id: "report",
    revision: 1,
  }));
  expect(control(host, "Client / Company").value).toBe("Synthetic group");
});
test("submitted read-only view shows the stored snapshot without save or submission controls", async () => {
  const workspace = fixture("reader");
  const content = {
    ...workspace.initial,
    tour: { ...workspace.initial.tour, client: "Submitted client snapshot" },
  };
  const report = {
    canArchive: false,
    canEdit: false,
    canRestore: false,
    content,
    id: "submitted",
    preparedBy: "Server-derived manager",
    revision: 2,
    status: "submitted",
    submittedAt: Date.UTC(2026, 9, 21),
    updatedAt: 1,
  };
  const host = await mount(workspace, noSubmit, { readOnly: true, report });
  expect(control(host, "Client / Company").value).toBe("Submitted client snapshot");
  expect(host.querySelector("form > fieldset").disabled).toBe(true);
  expect(button(host, "Save draft")).toBeUndefined();
  expect(button(host, "Submit report")).toBeUndefined();
  expect(host.textContent).toContain("Server-derived manager");
});
