import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const token = "a".repeat(43);
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: `https://citius.test/tour-feedback#${token}`,
});
const originalFetch = globalThis.fetch;
let createRoot;
let TravelerFeedbackForm;
let root;
let calls = [];
let submitFailures = 0;
let photoFailures = 0;
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
  dom.window.HTMLElement.prototype.scrollIntoView = () => {
    // JSDOM has no layout; the real browser checks scrolling separately.
  };
  ({ createRoot } = await import("react-dom/client"));
  ({ default: TravelerFeedbackForm } = await import("./TravelerFeedbackForm"));
});
afterEach(async () => {
  if (root) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
  globalThis.fetch = originalFetch;
  calls = [];
  submitFailures = 0;
  photoFailures = 0;
});
afterAll(() => dom.window.close());
function stubTransport() {
  globalThis.fetch = Object.assign(
    (url, init) => {
      calls.push({ init, url });
      if (url.endsWith("form")) {
        return Promise.resolve(
          Response.json({
            expiresAt: Date.now() + 1000,
            maxPhotoBytes: 4 * 1024 * 1024,
            maxPhotos: 8,
            publicTripLabel: "Greece group tour",
          })
        );
      }
      if (url.endsWith("submit")) {
        if (submitFailures > 0) {
          submitFailures -= 1;
          return Promise.resolve(
            Response.json({ error: "Connection failed. Try again." }, { status: 502 })
          );
        }
        return Promise.resolve(Response.json({ success: true }, { status: 201 }));
      }
      if (photoFailures > 0) {
        photoFailures -= 1;
        return Promise.reject(new Error("Connection lost after upload."));
      }
      return Promise.resolve(Response.json({ photoCount: 1, success: true }, { status: 201 }));
    },
    { preconnect: originalFetch.preconnect }
  );
}
async function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<TravelerFeedbackForm />);
    await Promise.resolve();
  });
  return container;
}
async function fill(container, text, category = "overall") {
  const field = container.querySelector(`textarea[name="${category}"]`);
  await act(() => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(
      field,
      text
    );
    field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
}
async function submit(container) {
  await act(async () => {
    container
      .querySelector("form")
      .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}
async function photo(container) {
  const input = container.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["synthetic"], "tour.jpg", { type: "image/jpeg" })],
  });
  await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
}
test("missing links show an actionable error and do not contact the backend", async () => {
  dom.window.location.hash = "";
  stubTransport();
  const container = await mount();
  expect(container.textContent).toContain("Open the full feedback link");
  expect(calls).toHaveLength(0);
  expect(container.querySelector("form")).toBeNull();
  dom.window.location.hash = token;
});
test("failed submission preserves comments and uses the same receipt on retry", async () => {
  stubTransport();
  submitFailures = 1;
  const container = await mount();
  await fill(container, "The guide was helpful.");
  await submit(container);
  expect(container.querySelector("textarea").value).toBe("The guide was helpful.");
  expect(container.textContent).toContain("Connection failed");
  await submit(container);
  expect(container.textContent).toContain("Thank you for sharing.");
  const payloads = calls
    .filter((call) => call.url.endsWith("submit"))
    .map((call) => JSON.parse(call.init.body));
  expect(payloads).toHaveLength(2);
  expect(payloads[0].responseToken).toBe(payloads[1].responseToken);
  expect(payloads[0].comments.overall).toBe("The guide was helpful.");
  expect(container.querySelector('input[type="email"]')).toBeNull();
});
test("photo retry shows the server's count without duplicating a committed upload", async () => {
  stubTransport();
  photoFailures = 1;
  const container = await mount();
  await fill(container, "A lovely tour.");
  await submit(container);
  await photo(container);
  expect(container.textContent).toContain("Connection lost after upload");
  expect(container.textContent).toContain("has been saved");
  await photo(container);
  expect(container.textContent).toContain("1 of 8 photos uploaded.");
  await photo(container);
  expect(container.textContent).toContain("1 of 8 photos uploaded.");
});

test("all six comment fields remain optional and submit through the existing contract", async () => {
  stubTransport();
  const container = await mount();
  const names = [...container.querySelectorAll("textarea")].map((field) => field.name);
  expect(names.sort((a, b) => a.localeCompare(b))).toEqual([
    "food",
    "hotel",
    "improvements",
    "itinerary",
    "overall",
    "whatWentWell",
  ]);
  expect(container.querySelector("details")).toBeNull();
  expect(container.querySelectorAll("textarea[required]")).toHaveLength(0);
  expect(container.querySelector('input[name="respondentName"]').required).toBe(false);
  for (const field of container.querySelectorAll("textarea")) {
    expect(field.labels[0].textContent).toContain("(optional)");
  }
  expect(container.textContent).toContain("Share at least one comment");
  expect(container.textContent).toContain("Skip any questions that don’t apply.");
  const hotel = container.querySelector('textarea[name="hotel"]');
  await act(() => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(
      hotel,
      "The hotel was comfortable."
    );
    hotel.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await submit(container);
  const payload = JSON.parse(calls.find((call) => call.url.endsWith("submit")).init.body);
  expect(payload.comments.hotel).toBe("The hotel was comfortable.");
  expect(payload.comments.overall).toBe("");
  expect(Object.keys(payload.comments).sort((a, b) => a.localeCompare(b))).toEqual(names);
  expect(document.activeElement.textContent).toBe("Thank you for sharing.");
});

test("section and skip navigation preserve the secret URL fragment", async () => {
  stubTransport();
  const container = await mount();
  const initialHash = dom.window.location.hash;
  const nav = container.querySelector('nav[aria-label="Feedback sections"]');
  await act(() =>
    [...nav.querySelectorAll("button")]
      .find((button) => button.textContent === "Journey details")
      .click()
  );
  expect(document.activeElement.textContent).toBe("Journey details");
  expect(dom.window.location.hash).toBe(initialHash);
  await act(() =>
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "Skip to feedback")
      .click()
  );
  expect(document.activeElement.id).toBe("feedback-content");
  expect(dom.window.location.hash).toBe(initialHash);
  expect(calls).toHaveLength(1);
});

test("empty feedback focuses a recoverable error without sending a response", async () => {
  stubTransport();
  const container = await mount();
  await submit(container);
  expect(calls.filter((call) => call.url.endsWith("submit"))).toHaveLength(0);
  expect(document.activeElement.getAttribute("role")).toBe("alert");
  expect(document.activeElement.textContent).toContain("Add a comment in at least one section.");
  await fill(container, "A thoughtful itinerary.");
  await submit(container);
  expect(container.textContent).toContain("Thank you for sharing.");
});

test.each(["overall", "itinerary", "hotel", "food", "whatWentWell", "improvements"])(
  "%s alone is enough, with name and all other questions left blank",
  async (category) => {
    stubTransport();
    const container = await mount();
    await fill(container, "The local guide was helpful.", category);
    await submit(container);
    const payload = JSON.parse(calls.find((call) => call.url.endsWith("submit")).init.body);
    expect(payload.respondentName).toBe("");
    expect(Object.values(payload.comments).filter(Boolean)).toHaveLength(1);
    expect(payload.comments[category]).toBe("The local guide was helpful.");
    expect(container.textContent).toContain("Thank you for sharing.");
    expect(container.textContent).toContain("Add photos (optional)");
    expect(calls.filter((call) => call.url.endsWith("photo"))).toHaveLength(0);
  }
);

test("whitespace and a name alone do not count as feedback", async () => {
  stubTransport();
  const container = await mount();
  const name = container.querySelector('input[name="respondentName"]');
  await act(() => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
      name,
      "A traveller"
    );
    name.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await fill(container, " \n\t\u00a0\u2003 ");
  await submit(container);
  expect(calls.filter((call) => call.url.endsWith("submit"))).toHaveLength(0);
  expect(document.activeElement.textContent).toContain("Add a comment in at least one section.");
  expect(container.querySelector('textarea[name="overall"]').value).toBe(" \n\t\u00a0\u2003 ");
});

test.each([
  ["unsupported", () => new File(["pdf"], "passport.pdf", { type: "application/pdf" })],
  [
    "oversized",
    () => new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" }),
  ],
])("%s photos never leave the saved response", async (_kind, createFile) => {
  stubTransport();
  const container = await mount();
  await fill(container, "The guide helped everyone.");
  await submit(container);
  const input = container.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", { configurable: true, value: [createFile()] });
  await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
  expect(container.textContent).toContain("Choose a JPEG, PNG or WebP photo no larger than 4 MB.");
  expect(container.textContent).toContain("has been saved");
  expect(calls.filter((call) => call.url.endsWith("photo"))).toHaveLength(0);
});
