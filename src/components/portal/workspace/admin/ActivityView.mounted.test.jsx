// biome-ignore-all lint/performance/noJsxPropsBind: mounted test mocks and callbacks are intentionally local.
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";

const pushed = [];
const historyQueries = [];
const historyResults = new Map();
let historyRows;

mock.module("@convex/_generated/api", () => ({
  api: { crm: { activity: { listNotifications: "listNotifications" } } },
}));

mock.module("convex/react", () => ({
  useQuery: (query, args) => {
    if (args === "skip") {
      return;
    }
    historyQueries.push({ args, query });
    if (!historyRows) {
      return;
    }
    // Convex returns the same result object until the data changes.
    if (!historyResults.has(args.limit)) {
      historyResults.set(args.limit, historyRows.slice(0, args.limit));
    }
    return historyResults.get(args.limit);
  },
}));

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: (href) => pushed.push(href) }),
}));

const dom = new JSDOM("<!doctype html><html><body></body></html>");

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

beforeEach(() => {
  pushed.length = 0;
  historyQueries.length = 0;
  historyResults.clear();
  historyRows = undefined;
});

async function render(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    rerender: (next) => act(async () => root.render(next)),
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

function buttonNamed(container, name) {
  return [...container.querySelectorAll("button")].find(
    (button) => button.textContent.trim() === name
  );
}

function updateButtons(container) {
  return [...container.querySelectorAll("li button")];
}

const NOW = new Date(2026, 10, 5, 15, 0).valueOf();
const hoursAgo = (hours) => new Date(NOW - hours * 3_600_000).toISOString();

function notification(id, overrides = {}) {
  return {
    body: `Body ${id}`,
    createdAt: hoursAgo(1),
    entityId: `query-${id}`,
    entityType: "query",
    id,
    readAt: null,
    title: `Update ${id}`,
    ...overrides,
  };
}

function activityProps(overrides = {}) {
  const reads = [];
  return {
    props: {
      deleteItem: () => undefined,
      markNotificationRead: (args) => {
        reads.push(args);
        return Promise.resolve();
      },
      notifications: [notification("n-1"), notification("n-2", { createdAt: hoursAgo(2) })],
      removeNotification: () => undefined,
      ...overrides,
    },
    reads,
  };
}

function activityLog(overrides = {}) {
  return {
    clearFilters: () => undefined,
    dateRange: { from: null, to: null },
    filterConfig: [],
    filterRows: [],
    filters: {},
    filtersActive: false,
    pagination: { canLoadMore: false, loadedCount: 2 },
    rows: [
      { actorName: "Asha Admin", createdAt: hoursAgo(1), id: "a-1", message: "Updated roles" },
      {
        actorName: "Dev Director",
        createdAt: hoursAgo(3),
        id: "a-2",
        message: "Opened a Job Card",
      },
    ],
    search: "",
    setDateRange: () => undefined,
    setFilter: () => undefined,
    setSearch: () => undefined,
    ...overrides,
  };
}

describe("Activity email delivery visibility", () => {
  test("Renders privacy-safe retry and exhausted summaries", async () => {
    const { EmailDeliveryStatusRegion } = await import("./ActivityView");
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

    expect(mounted.container.textContent).toContain("4 accepted");
    expect(mounted.container.textContent).toContain("8 total");
    expect(mounted.container.textContent).toContain("2 retrying");
    expect(mounted.container.textContent).toContain("1 need attention");
    expect(mounted.container.textContent).not.toContain("@");
    expect(mounted.container.querySelector("a")?.getAttribute("href")).toBe(
      "/portal/queries?open=query&id=query_1"
    );
    await mounted.unmount();
  });

  test("Explains each status that appears in plain words, with no resend action", async () => {
    const { EmailDeliveryStatusRegion } = await import("./ActivityView");
    const base = {
      queued: 0,
      retrying: 0,
      sending: 0,
      skipped: 0,
      updatedAt: Date.UTC(2026, 7, 8),
    };
    const mounted = await render(
      <EmailDeliveryStatusRegion
        coverage="complete"
        summaries={[
          { ...base, eventId: "accepted", exhausted: 0, sent: 3, total: 3 },
          { ...base, eventId: "failed", exhausted: 1, sent: 1, total: 2 },
        ]}
      />
    );
    const legend = mounted.container.querySelector("dl");
    expect(legend?.textContent).toContain("Accepted:");
    expect(legend?.textContent).toContain("Need attention:");
    expect(legend?.textContent).toContain("The update is still in the person's inbox here.");
    expect(legend?.textContent).not.toContain("Retrying:");
    expect(legend?.textContent).not.toContain("Skipped:");
    // The summary that needs attention is listed first; an origin-less summary is a workflow email.
    const titles = [
      ...mounted.container.querySelectorAll(".space-y-3 > div span.font-semibold"),
    ].map((node) => node.textContent);
    expect(titles).toEqual(["Workflow email", "Workflow email"]);
    const firstCard = mounted.container.querySelector(".space-y-3 > div");
    expect(firstCard?.textContent).toContain("1 need attention");
    expect(buttonNamed(mounted.container, "Resend")).toBeUndefined();
    await mounted.unmount();
  });

  test("Renders a deterministic empty state", async () => {
    const { EmailDeliveryStatusRegion } = await import("./ActivityView");
    const mounted = await render(<EmailDeliveryStatusRegion coverage="complete" summaries={[]} />);
    expect(mounted.container.textContent).toContain("No email delivery events yet");
    expect(mounted.container.querySelector("dl")).toBeNull();
    await mounted.unmount();
  });

  test("Labels legacy and interrupted reconciliation totals as partial", async () => {
    const { EmailDeliveryStatusRegion } = await import("./ActivityView");
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
    await mounted.unmount();
  });
});

describe("Notifications page read semantics", () => {
  test("Opening the page and switching filters marks nothing read", async () => {
    const { ActivityView } = await import("./ActivityView");
    const { props, reads } = activityProps();
    const mounted = await render(<ActivityView {...props} />);
    expect(reads).toEqual([]);
    await act(async () => buttonNamed(mounted.container, "All").click());
    await act(async () => buttonNamed(mounted.container, "Unread · 2").click());
    expect(reads).toEqual([]);
    expect(pushed).toEqual([]);
    await mounted.unmount();
  });

  test("Each activation reads exactly that update once and opens its work", async () => {
    const { ActivityView } = await import("./ActivityView");
    const { props, reads } = activityProps();
    const mounted = await render(<ActivityView {...props} />);
    const [first] = updateButtons(mounted.container);
    await act(async () => first.click());
    expect(reads).toEqual([{ notificationId: "n-1" }]);
    expect(pushed).toHaveLength(1);
    await mounted.unmount();
  });

  test("A late arrival stays unread after an earlier update is opened", async () => {
    const { ActivityView } = await import("./ActivityView");
    const { props, reads } = activityProps();
    const mounted = await render(<ActivityView {...props} />);
    await act(async () => updateButtons(mounted.container)[0].click());
    await mounted.rerender(
      <ActivityView
        {...props}
        notifications={[
          notification("n-3", { createdAt: hoursAgo(0.1) }),
          notification("n-1", { readAt: hoursAgo(0.5) }),
          notification("n-2", { createdAt: hoursAgo(2) }),
        ]}
      />
    );
    expect(reads).toEqual([{ notificationId: "n-1" }]);
    expect(buttonNamed(mounted.container, "Unread · 2")).toBeDefined();
    const unreadTitles = updateButtons(mounted.container).map(
      (button) => button.querySelector("span.font-semibold")?.textContent
    );
    expect(unreadTitles).toEqual(["Update n-3", "Update n-2"]);
    await mounted.unmount();
  });

  test("Staff without the activity log see only the inbox, with no log controls or counts", async () => {
    const { ActivityView } = await import("./ActivityView");
    const { props } = activityProps();
    const mounted = await render(<ActivityView {...props} />);
    expect(mounted.container.querySelector("details")).toBeNull();
    expect(mounted.container.textContent).not.toContain("Your updates");
    expect(mounted.container.textContent).not.toContain("entries loaded");
    expect(mounted.container.querySelector("input")).toBeNull();
    await mounted.unmount();
  });
});

describe("Notifications page older history", () => {
  const fullPage = Array.from({ length: 80 }, (_, index) =>
    notification(`n-${index}`, { createdAt: hoursAgo(index), readAt: hoursAgo(index) })
  );

  test("A full first page offers older updates on All only, and loading them reads nothing", async () => {
    const { ActivityView } = await import("./ActivityView");
    historyRows = [
      ...fullPage,
      ...Array.from({ length: 30 }, (_, index) =>
        notification(`old-${index}`, { createdAt: hoursAgo(90 + index), readAt: hoursAgo(90) })
      ),
    ];
    const { props, reads } = activityProps({ notifications: fullPage });
    const mounted = await render(<ActivityView {...props} />);
    expect(buttonNamed(mounted.container, "Show older updates")).toBeUndefined();
    await act(async () => buttonNamed(mounted.container, "All").click());
    expect(mounted.container.textContent).toContain("80 updates shown");
    await act(async () => buttonNamed(mounted.container, "Show older updates").click());
    expect(historyQueries.at(-1)).toEqual({
      args: { limit: 160 },
      query: "listNotifications",
    });
    expect(updateButtons(mounted.container)).toHaveLength(110);
    // Fewer than the requested page came back, so there is nothing older to offer.
    expect(buttonNamed(mounted.container, "Show older updates")).toBeUndefined();
    expect(reads).toEqual([]);
    await mounted.unmount();
  });

  test("While older updates load, the current list stays on screen", async () => {
    const { ActivityView } = await import("./ActivityView");
    const { props, reads } = activityProps({ notifications: fullPage });
    const mounted = await render(<ActivityView {...props} />);
    await act(async () => buttonNamed(mounted.container, "All").click());
    await act(async () => buttonNamed(mounted.container, "Show older updates").click());
    const loading = buttonNamed(mounted.container, "Loading older updates…");
    expect(loading?.disabled).toBe(true);
    expect(loading?.getAttribute("aria-busy")).toBe("true");
    expect(updateButtons(mounted.container)).toHaveLength(80);
    expect(reads).toEqual([]);
    await mounted.unmount();
  });

  test("A short first page offers no older history", async () => {
    const { ActivityView } = await import("./ActivityView");
    const { props } = activityProps();
    const mounted = await render(<ActivityView {...props} />);
    await act(async () => buttonNamed(mounted.container, "All").click());
    expect(buttonNamed(mounted.container, "Show older updates")).toBeUndefined();
    expect(historyQueries).toEqual([]);
    await mounted.unmount();
  });
});

describe("Activity log for Admin and Directors", () => {
  test("Search, dates and count live inside the collapsed log", async () => {
    const { ActivityView } = await import("./ActivityView");
    const { props } = activityProps();
    const mounted = await render(<ActivityView {...props} activityLog={activityLog()} />);
    const details = mounted.container.querySelector("details");
    expect(details?.open).toBe(false);
    expect(details?.querySelector("summary")?.textContent).toContain("Activity log");
    // Closed: no controls and no log count anywhere on the page.
    expect(mounted.container.querySelector('input[aria-label="Search activity log"]')).toBeNull();
    expect(mounted.container.textContent).not.toContain("entries loaded");
    details.open = true;
    await act(async () => details.dispatchEvent(new dom.window.Event("toggle")));
    expect(details.querySelector('input[aria-label="Search activity log"]')).not.toBeNull();
    expect(details.textContent).toContain("All 2 entries loaded");
    expect(details.textContent).toContain("Updated roles");
    await mounted.unmount();
  });

  test("Filters restored from the address bar open the log and say what matches", async () => {
    const { ActivityView } = await import("./ActivityView");
    const loads = [];
    const { props } = activityProps();
    const mounted = await render(
      <ActivityView
        {...props}
        activityLog={activityLog({
          filtersActive: true,
          pagination: { canLoadMore: true, loadedCount: 50, loadMore: () => loads.push(1) },
          rows: activityLog().rows.slice(0, 1),
          search: "roles",
        })}
      />
    );
    const details = mounted.container.querySelector("details");
    expect(details?.open).toBe(true);
    expect(details?.textContent).toContain("1 of 50 loaded entries match");
    expect(buttonNamed(details, "Clear filters")).toBeDefined();
    await act(async () => buttonNamed(details, "Load more entries").click());
    expect(loads).toEqual([1]);
    await mounted.unmount();
  });
});

describe("Notification inbox states", () => {
  test("the inbox keeps loading distinct from an empty result", async () => {
    const { NotificationInbox } = await import("@/components/portal/NotificationInbox");
    const noop = () => undefined;
    const mounted = await render(<NotificationInbox items={[]} loading onActivate={noop} />);
    expect(mounted.container.querySelector('[role="status"]')).not.toBeNull();
    expect(mounted.container.textContent).not.toContain("No notifications yet");
    await mounted.rerender(<NotificationInbox items={[]} onActivate={noop} />);
    expect(mounted.container.querySelector('[role="status"]')).toBeNull();
    expect(mounted.container.textContent).toContain("No notifications yet");
    await mounted.unmount();
  });

  test("unread-empty with read history offers the existing read updates", async () => {
    const { NotificationInbox } = await import("@/components/portal/NotificationInbox");
    const activations = [];
    const mounted = await render(
      <NotificationInbox
        items={[{ id: "read-1", readAt: "2026-10-20T08:00:00Z", title: "Existing read update" }]}
        onActivate={(item) => activations.push(item.id)}
      />
    );
    expect(mounted.container.textContent).toContain("You're all caught up");
    expect(mounted.container.textContent).toContain("No unread notifications");
    expect(mounted.container.textContent).not.toContain("No notifications yet");
    const viewRead = buttonNamed(mounted.container, "View read updates");
    expect(viewRead).toBeDefined();
    await act(async () => viewRead.click());
    expect(mounted.container.textContent).toContain("Existing read update");
    expect(activations).toEqual([]);
    await mounted.unmount();
  });

  test("updates are grouped under day headings that label their lists", async () => {
    const { NotificationInbox } = await import("@/components/portal/NotificationInbox");
    const items = [
      notification("today-1", { createdAt: new Date(2026, 10, 5, 14, 5).toISOString() }),
      notification("today-2", { createdAt: new Date(2026, 10, 5, 9, 30).toISOString() }),
      notification("yesterday", { createdAt: new Date(2026, 10, 4, 18, 0).toISOString() }),
      notification("older", { createdAt: new Date(2026, 10, 2, 8, 0).toISOString() }),
      notification("last-year", { createdAt: new Date(2025, 11, 30, 8, 0).toISOString() }),
    ];
    const mounted = await render(
      <NotificationInbox items={items} now={NOW} onActivate={() => undefined} />
    );
    const headings = [...mounted.container.querySelectorAll("h3")].map((h) => h.textContent);
    expect(headings).toEqual(["Today", "Yesterday", "Mon 2 Nov", "Tue 30 Dec 2025"]);
    const lists = [...mounted.container.querySelectorAll("ul")];
    expect(lists).toHaveLength(4);
    for (const list of lists) {
      const heading = mounted.container.querySelector(
        `[id="${list.getAttribute("aria-labelledby")}"]`
      );
      expect(heading?.tagName).toBe("H3");
    }
    expect(lists[0].querySelectorAll("li")).toHaveLength(2);
    expect(lists[0].querySelector("time")?.textContent).toBe("14:05");
    await mounted.unmount();
  });

  test("the bell's inbox never offers older history", async () => {
    const { NotificationInbox } = await import("@/components/portal/NotificationInbox");
    const mounted = await render(
      <NotificationInbox
        compact
        items={[notification("n-1", { readAt: hoursAgo(1) })]}
        onActivate={() => undefined}
      />
    );
    await act(async () => buttonNamed(mounted.container, "All").click());
    expect(buttonNamed(mounted.container, "Show older updates")).toBeUndefined();
    await mounted.unmount();
  });
});
