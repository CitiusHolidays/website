import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { act } from "react";
import { findButton, installPortalDom } from "../officeCheckIn/officeCheckInTestHarness";

const dom = installPortalDom("https://citiusholidays.com/portal/job-cards");

let createRoot;
let JobCardTravelBatchesCell;
let page = { results: [], status: "LoadingFirstPage" };
let queryArgs = [];
const loadMore = mock(() => undefined);

const BATCH = {
  batchReference: "B-1",
  confirmedPax: 3,
  destination: "Goa",
  id: "batch-1",
  roomCount: 2,
  status: "Open",
  travelStartDate: "2026-02-01",
};

beforeAll(async () => {
  const tracked = await import("@/lib/portal/trackedConvexSubscriptions");
  mock.module("@/lib/portal/trackedConvexSubscriptions", () => ({
    ...tracked,
    useTrackedPaginatedQuery: (_query, args) => {
      queryArgs.push(args);
      return { ...page, loadMore };
    },
  }));
  ({ createRoot } = await import("react-dom/client"));
  ({ JobCardTravelBatchesCell } = await import("./JobCardTravelBatchesCell"));
});

afterAll(() => dom.window.close());

async function mount({ canManage = true, travelBatchCount = 2 } = {}) {
  queryArgs = [];
  const opened = [];
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <JobCardTravelBatchesCell
        canManage={canManage}
        job={{ id: "job-1", travelBatchCount }}
        openModal={(...args) => opened.push(args)}
      />
    )
  );
  return {
    container,
    opened,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

async function expand(container) {
  await act(async () => container.querySelector("button[aria-expanded]").click());
}

describe("Job Card travel series cell", () => {
  test("Reads no series until expanded, then reads this Job Card's series", async () => {
    page = { results: [], status: "LoadingFirstPage" };
    const { container, unmount } = await mount();
    const toggle = container.querySelector("button[aria-expanded]");
    expect(toggle.textContent).toBe("View series (2)");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(queryArgs.at(-1)).toBe("skip");

    await expand(container);
    expect(toggle.textContent).toBe("Hide series");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(queryArgs.at(-1)).toEqual({ jobCardId: "job-1" });
    expect(container.textContent).toContain("Loading series…");
    expect(container.textContent).not.toContain("No series");

    await expand(container);
    expect(container.textContent).not.toContain("Loading series…");
    expect(queryArgs.at(-1)).toBe("skip");
    await unmount();
  });

  test("Says when there are no series, and leaves out the count when there is none", async () => {
    page = { results: [], status: "Exhausted" };
    const { container, unmount } = await mount({ travelBatchCount: 0 });
    expect(container.querySelector("button[aria-expanded]").textContent).toBe("View series");
    await expand(container);
    expect(container.textContent).toContain("No series");
    expect(findButton(container, "Load more series")).toBeUndefined();
    await unmount();
  });

  test("Lists series with Edit, loads four more on request, and shows loading more", async () => {
    page = { results: [BATCH], status: "CanLoadMore" };
    const { container, opened, unmount } = await mount();
    await expand(container);
    expect(container.textContent).toContain("B-1");
    expect(container.textContent).toContain("Goa · 3 pax · 2 rooms");
    expect(container.textContent).not.toContain("No series");

    await act(async () => findButton(container, "Load more series").click());
    expect(loadMore).toHaveBeenLastCalledWith(4);

    await act(async () => findButton(container, "Edit").click());
    expect(opened.at(-1)[0]).toBe("travelBatch");
    expect(opened.at(-1)[1]).toMatchObject({ batchReference: "B-1", entityId: "batch-1" });
    await unmount();

    page = { results: [BATCH], status: "LoadingMore" };
    const loadingMore = await mount();
    await expand(loadingMore.container);
    expect(loadingMore.container.textContent).toContain("Loading more…");
    expect(findButton(loadingMore.container, "Load more series")).toBeUndefined();
    await loadingMore.unmount();
  });

  test("Offers + Series and Edit only to people who can manage series", async () => {
    page = { results: [BATCH], status: "Exhausted" };
    const viewer = await mount({ canManage: false });
    await expand(viewer.container);
    expect(findButton(viewer.container, "+ Series")).toBeUndefined();
    expect(findButton(viewer.container, "Edit")).toBeUndefined();
    await viewer.unmount();

    const manager = await mount();
    await act(async () => findButton(manager.container, "+ Series").click());
    expect(manager.opened).toEqual([
      ["travelBatch", expect.objectContaining({ jobCardId: "job-1" })],
    ]);
    await manager.unmount();
  });
});
