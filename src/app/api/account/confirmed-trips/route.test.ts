import { beforeEach, describe, expect, mock, test } from "bun:test";

let authToken: string | null = "account-token";
const queryCalls: Array<{ args: unknown; options: unknown }> = [];
let queryResult: unknown = { continueCursor: "", isDone: true, page: [] };
let queryFailure = false;

mock.module("@/lib/auth-server", () => ({
  fetchAuthQuery: (_query: unknown, args: unknown, options: unknown) => {
    queryCalls.push({ args, options });
    if (queryFailure) {
      throw new Error("private backend details");
    }
    return queryResult;
  },
  getToken: () => authToken,
}));

const { GET } = await import("./route");

beforeEach(() => {
  authToken = "account-token";
  queryCalls.length = 0;
  queryFailure = false;
  queryResult = { continueCursor: "", isDone: true, page: [] };
});

describe("Customer confirmed-trip pagination route", () => {
  test("requires an authenticated Account request", async () => {
    authToken = null;

    const response = await GET(new Request("http://localhost/api/account/confirmed-trips"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });
    expect(queryCalls).toEqual([]);
  });

  test("forwards an opaque cursor in a private non-cacheable query", async () => {
    queryResult = {
      continueCursor: "next-cursor",
      isDone: false,
      page: [{ confirmedOfferId: "confirmedOffers_1" }],
    };

    const response = await GET(
      new Request("http://localhost/api/account/confirmed-trips?cursor=current-cursor")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(queryCalls).toEqual([
      {
        args: { paginationOpts: { cursor: "current-cursor", numItems: 20 } },
        options: { token: "account-token" },
      },
    ]);
    expect(await response.json()).toEqual(queryResult);
  });

  test("rejects an invalid cursor before the backend read", async () => {
    const response = await GET(new Request("http://localhost/api/account/confirmed-trips?cursor="));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid confirmed-trip cursor" });
    expect(queryCalls).toEqual([]);
  });

  test("does not expose backend failures", async () => {
    queryFailure = true;

    const response = await GET(new Request("http://localhost/api/account/confirmed-trips"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Confirmed trips could not be loaded. Please try again.",
    });
  });
});
