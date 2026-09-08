// biome-ignore-all lint/performance/noJsxPropsBind: mounted test actions stay with their scenario.
import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { Activity, act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/blog",
});
const originalFetch = globalThis.fetch;
let createRoot;
let BlogPageClient;
let PostPageClient;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.IntersectionObserver = undefined;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    this.dataset.restoredScroll = "true";
  };
  ({ createRoot } = await import("react-dom/client"));
  ({ default: BlogPageClient } = await import("./page.client"));
  ({ default: PostPageClient } = await import("./[slug]/page.client"));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  dom.window.history.replaceState({}, "", "/blog");
  document.body.replaceChildren();
});
afterAll(() => dom.window.close());

const posts = Array.from({ length: 13 }, (_, index) => ({
  _id: `post-${index}`,
  opening: [{ text: `A distinct introduction for story ${index}.` }],
  publishedAt: null,
  slug: { current: `story-${index}` },
  title: `Journal story ${index}`,
}));
const initialPage = {
  nextCursor: '["2026-08-02T00:00:00.000Z","post-11"]',
  posts: posts.slice(0, 12),
};

test("a failed continuation retains the list, Retry reaches story thirteen once, and Activity restores the list", async () => {
  let requests = 0;
  globalThis.fetch = (input) => {
    expect(new URL(input, dom.window.location.href).searchParams.get("after")).toBe(
      initialPage.nextCursor
    );
    requests += 1;
    return Promise.resolve(
      requests === 1
        ? Response.json({ message: "Unavailable" }, { status: 502 })
        : Response.json({ nextCursor: null, posts: [posts[11], posts[12]] })
    );
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (mode) =>
    root.render(
      <Activity mode={mode}>
        <BlogPageClient initialPage={initialPage} />
      </Activity>
    );
  await act(async () => render("visible"));
  expect(container.querySelectorAll("article")).toHaveLength(12);
  expect(container.querySelectorAll("h1")).toHaveLength(1);
  expect(container.querySelectorAll("time")).toHaveLength(0);
  const more = container.querySelector("button");
  more.focus();
  await act(async () => more.click());
  expect(container.querySelectorAll("article")).toHaveLength(12);
  expect(container.querySelector('[role="alert"]').textContent).toContain("Your place");
  expect(document.activeElement).toBe(more);
  expect(more.textContent).toBe("Retry");
  await act(async () => more.click());
  expect(container.querySelectorAll("article")).toHaveLength(13);
  expect(container.querySelectorAll('a[href="/blog/story-12"]')).toHaveLength(1);
  expect(container.querySelector("button")).toBeNull();
  expect(document.activeElement.id).toBe("story-post-12");
  expect(container.querySelector('[role="status"]').textContent).toBe("13 stories shown.");
  await act(async () => render("hidden"));
  dom.window.history.replaceState({}, "", "/blog#story-post-12");
  await act(async () => render("visible"));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  expect(container.querySelectorAll("article")).toHaveLength(13);
  expect(document.activeElement.id).toBe("story-post-12");
  expect(document.activeElement.dataset.restoredScroll).toBe("true");
  expect(requests).toBe(2);
  await act(async () => root.unmount());
});

test("pending continuation cannot submit twice and a malformed response leaves a retryable list", async () => {
  let finish;
  let requests = 0;
  globalThis.fetch = () => {
    requests += 1;
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<BlogPageClient initialPage={initialPage} />));
  const more = container.querySelector("button");
  await act(() => {
    more.click();
    more.click();
  });
  expect(requests).toBe(1);
  expect(more.disabled).toBe(true);
  await act(async () => finish(Response.json({ nextCursor: null, posts: "not a page" })));
  expect(container.querySelectorAll("article")).toHaveLength(12);
  expect(more.disabled).toBe(false);
  expect(more.textContent).toBe("Retry");
  await act(async () => root.unmount());
});

test("article keeps its body headings and safe links, omits invalid metadata, and returns to its journal anchor", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const post = {
    ...posts[12],
    author: { name: "Citius team" },
    body: [
      {
        _key: "heading",
        _type: "block",
        children: [{ _key: "title", _type: "span", marks: [], text: "About Malta" }],
        markDefs: [],
        style: "h2",
      },
      {
        _key: "paragraph",
        _type: "block",
        children: [
          {
            _key: "text",
            _type: "span",
            marks: ["unsafe"],
            text: "A preserved opening paragraph.",
          },
        ],
        markDefs: [{ _key: "unsafe", _type: "link", href: "javascript:alert(1)" }],
        style: "normal",
      },
    ],
    publishedAt: "2026-02-30",
  };
  await act(async () => root.render(<PostPageClient post={post} />));
  expect(container.querySelectorAll("h1")).toHaveLength(1);
  expect(container.querySelector("h2").textContent).toBe("About Malta");
  expect(container.textContent).toContain("A preserved opening paragraph.");
  expect(container.textContent).not.toContain("min read");
  expect(container.querySelector("time")).toBeNull();
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  expect(container.querySelector('a[href="/blog#story-post-12"]').textContent).toBe(
    "Back to Journal"
  );
  await act(async () => root.unmount());
});
