import { expect, test } from "bun:test";
import { getNotificationHref } from "./notificationPaths";
import { buildModalInitial, getDeepLinkQueryId, resolveDeepLink } from "./notificationTargets";
import { mergeFocusedRow } from "./paginatedRows";
import { pipeViewRows } from "./pipeViewRows";

test("Historical query action notifications focus retained detail without restoring it to the active table", () => {
  const retained = {
    clientName: "Acme",
    contractingStatus: "Order Lost",
    id: "lost-123",
    lostReason: "Competition",
    salesStatus: "Order Lost",
  };
  for (const title of ["Query ready for assignment", "Proposal ready for review"]) {
    const params = new URL(
      getNotificationHref({ entityId: "lost-123", entityType: "query", title }),
      "https://citius.test"
    ).searchParams;
    const link = { id: params.get("id"), open: params.get("open"), queryId: params.get("queryId") };
    expect(getDeepLinkQueryId(link)).toBe("lost-123");
    const collections = { queries: mergeFocusedRow([], retained) };
    const target = resolveDeepLink(link, collections);
    expect(buildModalInitial(target.modal, target, collections)).toMatchObject({
      queryId: "lost-123",
    });
    expect(
      pipeViewRows(collections.queries, {
        dateRange: {},
        filterConfig: [],
        listFilters: {},
        search: "",
        searchKeys: [],
        view: "queries",
      })
    ).toEqual([]);
  }
  expect(getDeepLinkQueryId({ id: "lost-123", open: "queryStatus" })).toBe("lost-123");
  expect(getDeepLinkQueryId({ id: "lost-123", open: "assignContracting" })).toBe("lost-123");
  expect(getDeepLinkQueryId({ id: "lost-123", open: "assignQueryTicketing" })).toBe("lost-123");
  expect(getDeepLinkQueryId({ id: "job-123", open: "jobCard" })).toBe(null);
  expect(getDeepLinkQueryId({ open: "jobCard", queryId: "query-123" })).toBe("query-123");
});
