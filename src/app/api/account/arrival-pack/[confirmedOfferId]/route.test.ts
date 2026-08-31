import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ArrivalPackPacket } from "@/lib/account/arrivalPackDocument";
import type { JsonValue } from "@/lib/jsonValue";

let authToken: string | null = "account-token";
let authFailure = false;
let queryFailure = false;
let queryResult: ArrivalPackPacket | null = null;
const queryCalls: Array<{ args: unknown; options: unknown }> = [];

mock.module("@/lib/auth-server", () => ({
  fetchAuthQuery: (_query: JsonValue, args: JsonValue, options: JsonValue) => {
    queryCalls.push({ args, options });
    if (queryFailure) {
      throw new Error("private backend failure");
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

function packet(): ArrivalPackPacket {
  return {
    confirmation: { at: 1_788_000_000_000, status: "confirmed" },
    confirmedOfferId: "confirmedOffers_1",
    entitlement: { role: "traveller", source: "identity_migration" },
    nextAction: {
      kind: "download_arrival_pack",
      label: "Download offline Arrival Pack",
    },
    readOnly: true,
    staySummary: { asOf: null, source: "unknown", status: "unknown", summary: null },
    travel: {
      asOf: 1_788_000_000_000,
      destination: "Kyoto",
      endDate: "2026-11-10",
      source: "confirmed_offer",
      startDate: "2026-11-01",
    },
  };
}

function request(id = "confirmedOffers_1") {
  return GET(new Request(`https://citiusholidays.com/api/account/arrival-pack/${id}`), {
    params: Promise.resolve({ confirmedOfferId: id }),
  });
}

beforeEach(() => {
  authToken = "account-token";
  authFailure = false;
  queryCalls.length = 0;
  queryFailure = false;
  queryResult = packet();
});

describe("Customer Arrival Pack output route", () => {
  test("requires Account authentication and keeps the denial private", async () => {
    authToken = null;

    const response = await request();

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(await response.json()).toEqual({ error: "Authentication required" });
    expect(queryCalls).toEqual([]);
  });

  test("keeps authentication service failures private and non-cacheable", async () => {
    authFailure = true;

    const response = await request();

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toEqual({
      error: "Arrival Pack could not be prepared. Please try again.",
    });
    expect(queryCalls).toEqual([]);
  });

  test("reauthorizes the exact offer and returns a self-contained no-store document", async () => {
    const response = await request();

    expect(response.status).toBe(200);
    expect(queryCalls).toEqual([
      {
        args: { confirmedOfferId: "confirmedOffers_1" },
        options: { token: "account-token" },
      },
    ]);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain(
      'attachment; filename="citius-arrival-pack.html"'
    );
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const document = await response.text();
    expect(document).toContain("Arrival Pack");
    expect(document).toContain("Pending — Unknown");
    expect(document).toContain("@media print");
  });

  test("denies output immediately when the fresh entitlement query returns null", async () => {
    queryResult = null;

    const response = await request();

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual({ error: "Arrival Pack not found" });
  });

  test("rejects an invalid offer identifier before reading customer data", async () => {
    const response = await request("../../other-account");

    expect(response.status).toBe(404);
    expect(queryCalls).toEqual([]);
  });

  test("does not expose backend failure details", async () => {
    queryFailure = true;

    const response = await request();

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual({
      error: "Arrival Pack could not be prepared. Please try again.",
    });
  });
});
