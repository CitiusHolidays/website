import { describe, expect, test } from "bun:test";
import {
  assertListSearchReady,
  buildJobCardListSearchText,
  buildProposalListSearchText,
  buildQueryListSearchText,
  buildTravellerListSearchText,
  isCurrentListSearchReadiness,
  LIST_SEARCH_PROJECTION_VERSION,
  reconcileAll,
  reconcilePage,
  summarizeListSearchReadiness,
} from "./listSearch";

describe("bounded portal list search projections", () => {
  test("reports first-deploy, interrupted, stale, and complete readiness without internal errors", () => {
    const now = Date.parse("2026-07-14T12:00:00.000Z");
    const summary = summarizeListSearchReadiness(
      [
        null,
        {
          generation: 3,
          ready: false,
          reconciling: true,
          startedAt: now - 2 * 60 * 60 * 1000,
          table: "jobCards",
          updatedAt: now - 2 * 60 * 60 * 1000,
          version: LIST_SEARCH_PROJECTION_VERSION,
        },
        null,
        {
          generation: 4,
          ready: true,
          reconciling: false,
          table: "travellers",
          updatedAt: now - 5 * 60 * 1000,
          version: LIST_SEARCH_PROJECTION_VERSION,
        },
      ],
      now
    );

    expect(summary.ready).toBe(false);
    expect(summary.details.queries).toMatchObject({ generation: 0, state: "pending" });
    expect(summary.details.jobCards).toMatchObject({ generation: 3, state: "stale" });
    expect(summary.details.travellers).toMatchObject({ generation: 4, state: "ready" });
    expect(summary.errorSummary).toBeNull();
  });

  test("indexes operational identifiers and labels", () => {
    expect(
      buildQueryListSearchText({
        clientName: "Acme India",
        destination: "Dubai",
        queryCode: "Q-0012",
        queryType: "MICE",
        salesOwnerName: "Nina Shah",
      })
    ).toBe("Q-0012 Acme India Dubai MICE Nina Shah");
    expect(
      buildJobCardListSearchText({
        clientName: "Acme India",
        destination: "Dubai",
        jobCode: "JC-0012-NS",
        queryType: "MICE",
      })
    ).toBe("JC-0012-NS Acme India Dubai MICE");
    expect(
      buildProposalListSearchText({
        clientName: "Acme India",
        preparedBy: "Nina Shah",
        proposalCode: "P-0012",
      })
    ).toBe("P-0012 Acme India Nina Shah");
  });

  test("indexes traveller workflow labels without passport secrets", () => {
    const text = buildTravellerListSearchText(
      {
        encryptedPassportPayload: "ciphertext-secret",
        fullName: "Anshika Agarwal",
        passportNumberHash: "hash-secret",
        passportStatus: "Uploaded",
        roomType: "Twin",
        sourceDealerName: "Citius Partner",
        travelHub: "Mumbai",
      },
      { jobCode: "JC-0012-NS", travelBatchReference: "Batch A" }
    );

    expect(text).toContain(
      "Anshika Agarwal JC-0012-NS Mumbai Citius Partner Uploaded Twin Batch A"
    );
    expect(text).not.toContain("ciphertext-secret");
    expect(text).not.toContain("hash-secret");
  });

  test("treats only the current completed projection version as searchable", () => {
    expect(
      isCurrentListSearchReadiness({ ready: true, version: LIST_SEARCH_PROJECTION_VERSION })
    ).toBe(true);
    expect(isCurrentListSearchReadiness({ ready: true })).toBe(false);
    expect(
      isCurrentListSearchReadiness({ ready: false, version: LIST_SEARCH_PROJECTION_VERSION })
    ).toBe(false);
  });

  test("routine reconciliation schedules bounded repairs without taking healthy search offline", async () => {
    const scheduled: Array<{ args: unknown; delay: number }> = [];
    const readinessByTable = new Map(
      ["queries", "jobCards", "proposals", "travellers"].map((table) => [
        table,
        {
          _id: `readiness_${table}`,
          ready: true,
          table,
          updatedAt: Date.now(),
          version: LIST_SEARCH_PROJECTION_VERSION,
        },
      ])
    );
    const result = await (reconcileAll as any)._handler(
      {
        db: {
          insert: () => {
            throw new Error("existing healthy rows should be patched");
          },
          patch: (id: string, patch: Record<string, unknown>) => {
            const row = Array.from(readinessByTable.values()).find((item) => item._id === id);
            if (row) {
              Object.assign(row, patch);
            }
          },
          query: () => ({
            withIndex: (_name: string, callback: (q: any) => unknown) => {
              let table = "";
              const q = {
                eq: (_field: string, value: string) => {
                  table = value;
                  return q;
                },
              };
              callback(q);
              return { unique: () => readinessByTable.get(table) ?? null };
            },
          }),
        },
        scheduler: {
          runAfter: (delay: number, _fn: unknown, args: unknown) => {
            scheduled.push({ args, delay });
          },
        },
      },
      {}
    );

    expect(result).toEqual({ scheduled: 4 });
    expect(scheduled).toHaveLength(4);
    expect(scheduled.every((entry) => entry.delay === 0)).toBe(true);
    expect(
      scheduled
        .map((entry) => (entry.args as { table: string }).table)
        .sort((left, right) => left.localeCompare(right))
    ).toEqual(["jobCards", "proposals", "queries", "travellers"]);
    expect(Array.from(readinessByTable.values()).every((row) => row.ready)).toBe(true);
    expect(
      scheduled.every(
        (entry) =>
          (entry.args as { cursor: string | null }).cursor === null &&
          (entry.args as { projectionVersion: number }).projectionVersion ===
            LIST_SEARCH_PROJECTION_VERSION
      )
    ).toBe(true);
  });

  test("an old in-flight page aborts and restarts the current projection from cursor zero", async () => {
    const scheduled: Array<{ args: any; delay: number }> = [];
    const state: Record<string, any> = {
      _id: "readiness_queries",
      generation: 7,
      ready: true,
      reconciling: true,
      startedAt: Date.now(),
      table: "queries",
      updatedAt: Date.now(),
      version: LIST_SEARCH_PROJECTION_VERSION - 1,
    };
    const result = await (reconcilePage as any)._handler(
      {
        db: {
          insert: () => {
            throw new Error("the existing generation row should be patched");
          },
          patch: (_id: string, patch: Record<string, unknown>) => Object.assign(state, patch),
          query: (table: string) => {
            if (table !== "crmListSearchReadiness") {
              throw new Error("a stale page must not project source rows");
            }
            return {
              withIndex: (_name: string, callback: (q: any) => unknown) => {
                const q = { eq: () => q };
                callback(q);
                return { unique: () => state };
              },
            };
          },
        },
        scheduler: {
          runAfter: (delay: number, _fn: unknown, args: unknown) => {
            scheduled.push({ args, delay });
          },
        },
      },
      {
        cursor: "old-version-cursor",
        table: "queries",
      }
    );

    expect(result).toMatchObject({ processed: 0, restarted: true, stale: true });
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toMatchObject({
      args: {
        cursor: null,
        generation: 8,
        projectionVersion: LIST_SEARCH_PROJECTION_VERSION,
        table: "queries",
      },
      delay: 0,
    });
    expect(state).toMatchObject({
      generation: 8,
      ready: false,
      reconciling: true,
      version: LIST_SEARCH_PROJECTION_VERSION,
    });
  });

  test("server search rejects direct clients until that table reaches the current version", async () => {
    const ctxFor = (row: unknown) => ({
      db: {
        query: () => ({
          withIndex: (_name: string, callback: (q: any) => unknown) => {
            const q = { eq: () => q };
            callback(q);
            return { unique: () => row };
          },
        }),
      },
    });

    await expect(assertListSearchReady(ctxFor({ ready: true }), "queries", "Acme")).rejects.toThrow(
      "SEARCH_INDEX_PREPARING"
    );
    await expect(
      assertListSearchReady(
        ctxFor({ ready: true, version: LIST_SEARCH_PROJECTION_VERSION }),
        "queries",
        "Acme"
      )
    ).resolves.toBeUndefined();
    await expect(assertListSearchReady(ctxFor(null), "queries", "")).resolves.toBeUndefined();
  });
});
