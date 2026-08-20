import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const queryResults = [undefined, undefined, undefined, undefined];
let queryCall = 0;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  mock.module("convex/react", () => ({
    usePaginatedQuery: () => ({ results: [], status: "Exhausted" }),
    useQuery: () => {
      const result = queryResults[queryCall % 4];
      queryCall += 1;
      return result;
    },
  }));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

describe("UseDashboardSummary", () => {
  test("Composes coverage, people, and activity as each independent query arrives", async () => {
    const { useDashboardSummary } = await import("./usePortalDashboardSummary");
    const container = document.createElement("div");
    const root = createRoot(container);

    function Probe({ revision }) {
      const summary = useDashboardSummary(true, true, undefined, revision, "dashboard");
      return <output>{JSON.stringify(summary)}</output>;
    }

    queryResults[0] = {
      aggregateCoverage: { state: "pending" },
      metrics: { activeQueries: 2 },
      recentActivity: [],
    };
    queryCall = 0;
    await act(async () => root.render(<Probe revision={1} />));
    expect(JSON.parse(container.textContent)).toEqual(queryResults[0]);

    queryResults[1] = { complete: true, state: "ready" };
    queryResults[2] = { capacity: [{ role: "Sales" }], myTeam: [{ id: "staff_1" }] };
    queryCall = 0;
    await act(async () => root.render(<Probe revision={2} />));
    expect(JSON.parse(container.textContent)).toMatchObject({
      aggregateCoverage: { complete: true, state: "ready" },
      capacity: [{ role: "Sales" }],
      metrics: { activeQueries: 2 },
      myTeam: [{ id: "staff_1" }],
      recentActivity: [],
    });

    queryResults[3] = [{ action: "created", id: "activity_1" }];
    queryCall = 0;
    await act(async () => root.render(<Probe revision={3} />));
    expect(JSON.parse(container.textContent).recentActivity).toEqual(queryResults[3]);

    await act(async () => root.unmount());
  });
});
