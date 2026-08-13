import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertListSearchReady,
  buildJobCardListSearchText,
  buildProposalListSearchText,
  buildQueryListSearchText,
  buildTravellerListSearchText,
  isCurrentListSearchReadiness,
  LIST_SEARCH_PROJECTION_VERSION,
  markListSearchDirty,
  reconcileAll,
  reconcileDirtyPage,
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
    expect(summary.dirty).toEqual({ hasPending: false, oldestUpdatedAt: null });
    expect(summary.errorSummary).toBeNull();
  });

  test("keeps every authoritative search writer on durable dirty coverage", () => {
    const writerPaths = [
      "queryCreation.ts",
      "queryCommands.ts",
      "queryDeletion.ts",
      "jobCardCreation.ts",
      "jobCardCommands.ts",
      "lib/presentation.ts",
      "proposalWriteCommands.ts",
      "proposals.ts",
      "travellers.ts",
      "passport.ts",
      "importProcessor.ts",
    ];
    for (const relativePath of writerPaths) {
      expect(readFileSync(join(import.meta.dir, relativePath), "utf8"), relativePath).toContain(
        "markListSearchDirty"
      );
    }

    const listSearch = readFileSync(join(import.meta.dir, "listSearch.ts"), "utf8");
    const schema = readFileSync(join(import.meta.dir, "../schema.ts"), "utf8");
    expect(listSearch).not.toContain("PROPOSAL_ATTACHMENT_SUMMARY_VERSION");
    expect(listSearch).not.toContain("proposalLinkProjection");
    expect(listSearch).not.toContain("passportDetails");
    expect(listSearch).not.toContain("travelBatches");
    expect(schema).toContain("crmListSearchDirty: defineTable");
    expect(schema).toContain('.index("by_key", ["key"])');
    expect(schema).toContain('.index("by_updatedAt", ["updatedAt"])');
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

  test("routine reconciliation returns without source traversal when readiness is current", async () => {
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
            throw new Error("a healthy tick should not insert state");
          },
          patch: () => {
            throw new Error("a healthy tick should not patch state");
          },
          query: (sourceTable: string) => ({
            first: () => {
              if (sourceTable !== "crmListSearchDirty") {
                throw new Error("only the dirty queue may use first");
              }
              return null;
            },
            withIndex: (_name: string, callback: (q: any) => unknown) => {
              if (sourceTable === "crmListSearchDirty") {
                return { first: () => null };
              }
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

    expect(result).toEqual({ scheduled: 0 });
    expect(scheduled).toEqual([]);
    expect(Array.from(readinessByTable.values()).every((row) => row.ready)).toBe(true);
  });

  test("an explicit repair schedules all four current tables without dropping publication", async () => {
    const scheduled: unknown[] = [];
    const patched: unknown[] = [];
    const readinessByTable = new Map(
      ["queries", "jobCards", "proposals", "travellers"].map((table) => [
        table,
        {
          _id: `ready_${table}`,
          generation: 8,
          ready: true,
          reconciling: false,
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
            throw new Error("current readiness rows should be patched");
          },
          patch: (_table: string, id: string, patch: Record<string, unknown>) => {
            patched.push({ id, patch });
          },
          query: (sourceTable: string) => ({
            withIndex: (_name: string, callback?: (q: any) => unknown) => {
              if (sourceTable === "crmListSearchDirty") {
                return { first: () => null };
              }
              let table = "";
              const q = {
                eq: (_field: string, value: string) => {
                  table = value;
                  return q;
                },
              };
              callback?.(q);
              return { unique: () => readinessByTable.get(table) ?? null };
            },
          }),
        },
        scheduler: {
          runAfter: (_delay: number, _fn: unknown, args: unknown) => scheduled.push(args),
        },
      },
      { force: true }
    );

    expect(result).toEqual({ scheduled: 4 });
    expect(patched).toHaveLength(4);
    expect(scheduled).toHaveLength(4);
    expect(scheduled.every((args) => (args as { cursor: unknown }).cursor === null)).toBe(true);
  });

  test("coalesces dirty source identities and schedules only the first unit", async () => {
    const rows = new Map<string, Record<string, any>>();
    const scheduled: unknown[] = [];
    const ctx = {
      db: {
        insert: (_table: string, row: Record<string, any>) => {
          rows.set(row.key, { ...row, _id: `dirty_${rows.size + 1}` });
        },
        patch: (_table: string, id: string, patch: Record<string, unknown>) => {
          const row = Array.from(rows.values()).find((candidate) => candidate._id === id);
          if (row) {
            Object.assign(row, patch);
          }
        },
        query: () => ({
          withIndex: (_name: string, callback: (q: any) => unknown) => {
            let key = "";
            const q = {
              eq: (_field: string, value: string) => {
                key = value;
                return q;
              },
            };
            callback(q);
            return { unique: () => rows.get(key) ?? null };
          },
        }),
      },
      scheduler: {
        runAfter: (_delay: number, _fn: unknown, args: unknown) => scheduled.push(args),
      },
    };

    await markListSearchDirty(ctx as any, "travellers", "traveller_1");
    await markListSearchDirty(ctx as any, "travellers", "traveller_1");

    expect(rows.size).toBe(1);
    expect(scheduled).toHaveLength(1);
  });

  test("repairs dirty rows in bounded batches and consumes deletion tombstones", async () => {
    const dirtyRows = [
      {
        _id: "dirty_query",
        sourceId: "query_1",
        table: "queries",
        updatedAt: 1,
      },
      {
        _id: "dirty_deleted",
        sourceId: "query_deleted",
        table: "queries",
        updatedAt: 2,
      },
    ];
    const query = {
      _id: "query_1",
      clientName: "Acme",
      destination: "Delhi",
      listSearchText: "stale",
      queryCode: "Q-1",
      queryType: "MICE",
      salesOwnerName: "Nina",
    };
    const deleted: string[] = [];
    const patched: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const result = await (reconcileDirtyPage as any)._handler(
      {
        db: {
          delete: (_table: string, id: string) => deleted.push(id),
          get: (_table: string, id: string) => (id === "query_1" ? query : null),
          normalizeId: (_table: string, id: string) => id,
          patch: (_table: string, id: string, patch: Record<string, unknown>) => {
            patched.push({ id, patch });
          },
          query: () => ({
            withIndex: () => ({
              order: () => ({ take: () => dirtyRows }),
            }),
          }),
        },
        scheduler: { runAfter: () => undefined },
      },
      {}
    );

    expect(result).toEqual({ changed: 1, processed: 2, scheduled: false });
    expect(patched).toEqual([
      {
        id: "query_1",
        patch: { listSearchText: "Q-1 Acme Delhi MICE Nina" },
      },
    ]);
    expect(deleted.sort((left, right) => left.localeCompare(right))).toEqual([
      "dirty_deleted",
      "dirty_query",
    ]);
  });

  test("full repair remains complete for every search table without unrelated relation reads", async () => {
    const fixtures = [
      {
        expected: "Q-1 Acme Delhi MICE Nina",
        row: {
          _id: "query_1",
          clientName: "Acme",
          destination: "Delhi",
          listSearchText: "stale",
          queryCode: "Q-1",
          queryType: "MICE",
          salesOwnerName: "Nina",
        },
        table: "queries",
      },
      {
        expected: "JC-1 Acme Delhi MICE",
        row: {
          _id: "job_1",
          clientName: "Acme",
          destination: "Delhi",
          jobCode: "JC-1",
          listSearchText: "stale",
          queryType: "MICE",
        },
        table: "jobCards",
      },
      {
        expected: "P-1 Acme Nina",
        row: {
          _id: "proposal_1",
          clientName: "Acme",
          listSearchText: "stale",
          preparedBy: "Nina",
          proposalCode: "P-1",
        },
        table: "proposals",
      },
      {
        expected: "Anshika JC-1 Mumbai Received Twin JC-1 / B1",
        row: {
          _id: "traveller_1",
          fullName: "Anshika",
          jobCardId: "job_1",
          listSearchText: "stale",
          passportStatus: "Received",
          roomType: "Twin",
          travelBatchReference: "JC-1 / B1",
          travelHub: "Mumbai",
        },
        table: "travellers",
      },
    ] as const;

    await Promise.all(
      fixtures.map(async (fixture) => {
        const state: Record<string, any> = {
          _id: `ready_${fixture.table}`,
          generation: 3,
          ready: true,
          reconciling: true,
          table: fixture.table,
          updatedAt: Date.now(),
          version: LIST_SEARCH_PROJECTION_VERSION,
        };
        const sourcePatches: Record<string, unknown>[] = [];
        const result = await (reconcilePage as any)._handler(
          {
            db: {
              get: (table: string, id: string) => {
                if (fixture.table !== "travellers" || table !== "jobCards" || id !== "job_1") {
                  throw new Error(`unexpected relation read ${table}:${id}`);
                }
                return { _id: "job_1", jobCode: "JC-1" };
              },
              patch: (table: string, id: string, patch: Record<string, unknown>) => {
                if (id === state._id) {
                  Object.assign(state, patch);
                } else {
                  expect(table).toBe(fixture.table);
                  sourcePatches.push(patch);
                }
              },
              query: (table: string) => {
                if (table === "crmListSearchReadiness") {
                  return {
                    withIndex: () => ({ unique: () => state }),
                  };
                }
                if (table !== fixture.table) {
                  throw new Error(`unexpected source read ${table}`);
                }
                return {
                  order: () => ({
                    paginate: () => ({ continueCursor: "", isDone: true, page: [fixture.row] }),
                  }),
                };
              },
            },
            scheduler: { runAfter: () => undefined },
          },
          {
            cursor: null,
            generation: 3,
            projectionVersion: LIST_SEARCH_PROJECTION_VERSION,
            table: fixture.table,
          }
        );

        expect(result).toMatchObject({ changed: 1, isDone: true, processed: 1 });
        expect(sourcePatches).toEqual([{ listSearchText: fixture.expected }]);
        expect(state).toMatchObject({ ready: true, reconciling: false });
      })
    );
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
          patch: (_table: string, _id: string, patch: Record<string, unknown>) =>
            Object.assign(state, patch),
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
