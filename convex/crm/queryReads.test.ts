import { describe, expect, test } from "bun:test";
import { fromPartial } from "@total-typescript/shoehorn";
import type { QueryCtx } from "../_generated/server";
import { handleQueryListPage } from "./queryReads";

interface CursorTestRow {
  _id: string;
  active?: boolean;
  authUserId?: string;
  clientName?: string;
  contractingStatus?: string;
  createdAt?: number;
  email?: string;
  name?: string;
  paxCount?: number;
  queryCode?: string;
  queryId?: string;
  queryType?: string;
  roles?: string[];
  salesStatus?: string;
  travelType?: string;
  updatedAt?: number;
}

interface CursorTestRange {
  eq: (field: "authUserId" | "queryId", value: string) => CursorTestRange;
}

function confirmedQuery(id: string, createdAt: number) {
  return {
    _id: id,
    clientName: `Client ${id}`,
    contractingStatus: "Order Confirmed",
    createdAt,
    paxCount: 2,
    queryCode: `Q-${id}`,
    queryType: "MICE",
    salesStatus: "Order Confirmed",
    travelType: "International Travel",
    updatedAt: createdAt,
  };
}

function buildCursorTestCtx() {
  const queries = [confirmedQuery("query_1", 2), confirmedQuery("query_2", 1)];
  const tables = new Map<string, CursorTestRow[]>([
    ["jobCards", [{ _id: "job_1", queryId: "query_1" }]],
    ["queries", queries],
    [
      "staffUsers",
      [
        {
          _id: "staff_1",
          active: true,
          authUserId: "auth_1",
          email: "accounts@example.com",
          name: "Accounts User",
          roles: ["Accounts"],
        },
      ],
    ],
  ]);
  const paginateCursors: Array<string | null> = [];

  const builder = (table: string, rows = tables.get(table) ?? []) => ({
    filter: () => builder(table, rows),
    first: async () => rows[0] ?? null,
    order: () => builder(table, rows),
    paginate: ({ cursor }: { cursor: string | null }) => {
      paginateCursors.push(cursor);
      const index = cursor === null ? 0 : 1;
      return Promise.resolve({
        continueCursor: index === 0 ? "cursor_after_opened" : "",
        isDone: index === 1,
        page: [queries[index]],
      });
    },
    take: async (limit: number) => rows.slice(0, limit),
    withIndex: (_indexName: string, applyRange?: (range: CursorTestRange) => CursorTestRange) => {
      let equality: { field: "authUserId" | "queryId"; value: string } | null = null;
      const range: CursorTestRange = {
        eq(field, value) {
          equality = { field, value };
          return range;
        },
      };
      applyRange?.(range);
      const selected = equality
        ? rows.filter((row) => row[equality?.field ?? "authUserId"] === equality?.value)
        : rows;
      return builder(table, selected);
    },
  });
  const testCtx = {
    auth: {
      getUserIdentity: async () => ({ subject: "auth_1" }),
    },
    db: {
      query: (table: string) => builder(table),
    },
  };
  // SAFETY: this fake implements the bounded query methods exercised by the list reader.
  const ctx = fromPartial<typeof testCtx & QueryCtx>(testCtx);
  return { ctx, paginateCursors };
}

describe("Query Job Card state pagination", () => {
  test("Keeps a tail match reachable after a sparse anti-join page", async () => {
    const { ctx, paginateCursors } = buildCursorTestCtx();
    const first = await handleQueryListPage(ctx, {
      jobCardState: "Not opened",
      paginationOpts: { cursor: null, numItems: 1 },
    });

    expect(first).toMatchObject({
      continueCursor: "cursor_after_opened",
      isDone: false,
      page: [],
    });

    const second = await handleQueryListPage(ctx, {
      jobCardState: "Not opened",
      paginationOpts: { cursor: first.continueCursor, numItems: 1 },
    });

    expect(second.isDone).toBe(true);
    expect(second.page.map((row) => row.id)).toEqual(["query_2"]);
    expect(second.page[0]?.jobCardState).toBe("Not opened");
    expect(paginateCursors).toEqual([null, "cursor_after_opened"]);
  });
});
