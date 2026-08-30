import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { JsonValue } from "@/lib/jsonValue";

let authToken: string | null = "account-token";
let authFailure = false;
const queryCalls: Array<{ args: unknown; options: unknown }> = [];
interface ConfirmedTripsPage {
  continueCursor: string;
  isDone: boolean;
  page: Array<{ confirmedOfferId?: string }>;
}

let queryResult: ConfirmedTripsPage = { continueCursor: "", isDone: true, page: [] };
let queryFailure = false;

mock.module("@/lib/auth-server", () => ({
  fetchAuthQuery: (_query: JsonValue, args: JsonValue, options: JsonValue) => {
    queryCalls.push({ args, options });
    if (queryFailure) {
      throw new Error("private backend details");
    }
    return queryResult;
  },
  getToken: () => {
    if (authFailure) {
      throw new Error("private authentication transport details");
    }
    return authToken;
  },
}));

const { GET } = await import("./route");

beforeEach(() => {
  authToken = "account-token";
  authFailure = false;
  queryCalls.length = 0;
  queryFailure = false;
  queryResult = { continueCursor: "", isDone: true, page: [] };
});

describe("Customer confirmed-trip pagination route", () => {
  test("Requires an authenticated Account request", async () => {
    authToken = null;

    const response = await GET(new Request("http://localhost/api/account/confirmed-trips"));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual({ error: "Authentication required" });
    expect(queryCalls).toEqual([]);
  });

  test("Keeps authentication service failures private and non-cacheable", async () => {
    authFailure = true;

    const response = await GET(new Request("http://localhost/api/account/confirmed-trips"));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toEqual({
      error: "Confirmed trips could not be loaded. Please try again.",
    });
    expect(queryCalls).toEqual([]);
  });

  test("Forwards an opaque cursor in a private non-cacheable query", async () => {
    queryResult = {
      continueCursor: "next-cursor",
      isDone: false,
      page: [{ confirmedOfferId: "confirmedOffers_1" }],
    };

    const response = await GET(
      new Request("http://localhost/api/account/confirmed-trips?cursor=current-cursor")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(queryCalls).toEqual([
      {
        args: { paginationOpts: { cursor: "current-cursor", numItems: 20 } },
        options: { token: "account-token" },
      },
    ]);
    expect(await response.json()).toEqual(queryResult);
  });

  test("Rejects an invalid cursor before the backend read", async () => {
    const response = await GET(new Request("http://localhost/api/account/confirmed-trips?cursor="));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual({ error: "Invalid confirmed-trip cursor" });
    expect(queryCalls).toEqual([]);
  });

  test("Does not expose backend failures", async () => {
    queryFailure = true;

    const response = await GET(new Request("http://localhost/api/account/confirmed-trips"));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual({
      error: "Confirmed trips could not be loaded. Please try again.",
    });
  });
});
