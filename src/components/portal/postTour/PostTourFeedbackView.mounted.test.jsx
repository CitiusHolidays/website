// biome-ignore-all lint/performance/noJsxPropsBind: tests provide callbacks at the public view boundary.
import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://citius.test" });
let createRoot;
let PostTourFeedbackView;
let root;
beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  for (const name of [
    "window",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLTextAreaElement",
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
  ({ PostTourFeedbackView } = await import("./PostTourFeedbackView"));
});
afterEach(async () => {
  if (root) {
    await act(async () => root.unmount());
  }
  document.body.replaceChildren();
});
afterAll(() => dom.window.close());

const job = {
  canCompose: true,
  clientName: "Synthetic client",
  destination: "Kochi",
  jobCardId: "job-1",
  jobCode: "JC/TEST/001",
  travelEndDate: "2026-10-04",
  travelStartDate: "2026-10-01",
};
const entry = {
  authorName: "Synthetic manager",
  canDelete: true,
  canEdit: true,
  category: "hotel",
  comment: "Quiet rooms and helpful staff.",
  createdAt: 1,
  id: "feedback-1",
  job,
  photos: [],
  updatedAt: 1,
  vendorName: "Harbour hotel",
  vendorRating: null,
};
const noop = () => Promise.resolve();
async function mount(props = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <PostTourFeedbackView
        entries={[]}
        job={job}
        onDelete={noop}
        onRemovePhoto={noop}
        onSave={noop}
        onUpdate={noop}
        onUpload={noop}
        {...props}
      />
    )
  );
  return container;
}
function button(container, text) {
  return [...container.querySelectorAll("button")].find((item) => item.textContent === text);
}
async function comment(container, text) {
  const input = container.querySelector("textarea");
  await act(() => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(
      input,
      text
    );
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
}

test("readers see feedback with no write or upload controls", async () => {
  const container = await mount({
    entries: [{ ...entry, canDelete: false, canEdit: false }],
    job: { ...job, canCompose: false },
  });
  expect(container.textContent).toContain("Quiet rooms and helpful staff.");
  expect(container.querySelector("form")).toBeNull();
  expect(container.querySelector('input[type="file"]')).toBeNull();
  expect(button(container, "Delete feedback")).toBeUndefined();
});

test("a failed private photo has a keyboard-operable retry", async () => {
  const container = await mount({
    entries: [
      {
        ...entry,
        photos: [{ fileName: "hotel.jpg", fileSize: 100, id: "photo-1", mimeType: "image/jpeg" }],
      },
    ],
  });
  const image = container.querySelector("img");
  expect(image.src).toContain("inline=1");
  await act(() => image.dispatchEvent(new dom.window.Event("error")));
  expect(container.textContent).toContain("Photo could not be loaded");
  await act(() => button(container, "Retry photo").click());
  expect(container.querySelector("img").src).toContain("retry=1");
});

test("failed save preserves the comment and retry saves it with an N/A rating", async () => {
  const saved = [];
  let fail = true;
  const container = await mount({
    onSave: (draft) => {
      if (fail) {
        return Promise.reject(new Error("offline"));
      }
      saved.push(draft);
      return Promise.resolve();
    },
  });
  await comment(container, "Food quality needs follow-up.");
  await act(async () =>
    container
      .querySelector("form")
      .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))
  );
  expect(container.querySelector('[role="alert"]').textContent).toContain(
    "Your text is still here"
  );
  expect(container.querySelector("textarea").value).toBe("Food quality needs follow-up.");
  fail = false;
  await act(async () =>
    container
      .querySelector("form")
      .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))
  );
  expect(saved).toEqual([
    {
      category: "overall",
      comment: "Food quality needs follow-up.",
      vendorName: "",
      vendorRating: null,
    },
  ]);
  expect(container.querySelector("textarea").value).toBe("");
  expect(container.textContent).toContain("Feedback saved");
});

test("photo failures retain saved comments and destructive feedback deletion has a confirmation", async () => {
  let deleted = 0;
  const container = await mount({
    entries: [entry],
    onDelete: () => {
      deleted += 1;
      return Promise.resolve();
    },
    onUpload: () => Promise.reject(new Error("offline")),
  });
  const file = new dom.window.File(["synthetic"], "hotel.jpg", { type: "image/jpeg" });
  const input = container.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
  expect(container.textContent).toContain("Your comments are saved");
  expect(container.textContent).toContain(entry.comment);
  await act(async () => button(container, "Delete feedback").click());
  expect(deleted).toBe(0);
  await act(async () => button(container, "Keep feedback").click());
  expect(deleted).toBe(0);
  await act(async () => button(container, "Delete feedback").click());
  await act(async () => button(container, "Delete permanently").click());
  expect(deleted).toBe(1);
});
