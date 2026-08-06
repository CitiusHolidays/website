import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  classifyNudgeFailure,
  classifyStaleNudgeRunState,
  collectRiskItemsPage,
  isNudgeRunStale,
  retryNudgeRun,
  retryNudgeRunState,
  runNudgePage,
  shouldTrigger,
} from "./workflowNudges";

const referenceNow = Date.parse("2026-08-01T12:00:00.000Z");

function makeRunCtx({
  failure,
  initialRun,
  ruleRun,
}: {
  failure?: { error: Error; table: string };
  initialRun?: Record<string, any>;
  ruleRun?: Record<string, any>;
} = {}) {
  let idSequence = 0;
  const scheduled: Array<{ args: any; delay: number }> = [];
  const paginatedTables: string[] = [];
  const tables: Record<string, any[]> = {
    invoices: [],
    jobCards: [],
    portalWorkflowNudgeRuns: initialRun ? [{ _id: "run_1", ...initialRun }] : [],
    portalWorkflowRuleRuns: ruleRun ? [{ _id: "rule_run_1", ...ruleRun }] : [],
    queries: [],
    tickets: [],
  };
  const db = {
    insert: (table: string, value: Record<string, any>) => {
      idSequence += 1;
      const id = `${table}_${idSequence}`;
      tables[table] ??= [];
      tables[table].push({ _id: id, ...value });
      return id;
    },
    patch: (id: string, patch: Record<string, any>) => {
      for (const rows of Object.values(tables)) {
        const row = rows.find((candidate) => candidate._id === id);
        if (row) {
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined) {
              delete row[key];
            } else {
              row[key] = value;
            }
          }
          return;
        }
      }
      throw new Error(`Missing row ${id}`);
    },
    query: (table: string) => {
      const filters = new Map<string, unknown>();
      const builder = {
        first: () => tables[table]?.find(matches) ?? null,
        order: () => builder,
        paginate: ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
          paginatedTables.push(table);
          if (failure?.table === table) {
            throw failure.error;
          }
          const offset = cursor ? Number(cursor) : 0;
          const rows = (tables[table] ?? []).filter(matches);
          const page = rows.slice(offset, offset + numItems);
          const nextOffset = offset + page.length;
          return {
            continueCursor: String(nextOffset),
            isDone: nextOffset >= rows.length,
            page,
          };
        },
        unique: () => {
          const matchesRows = (tables[table] ?? []).filter(matches);
          if (matchesRows.length > 1) {
            throw new Error(`Expected unique ${table} row`);
          }
          return matchesRows[0] ?? null;
        },
        withIndex: (_name: string, callback: (q: any) => unknown) => {
          const q = {
            eq: (field: string, value: unknown) => {
              filters.set(field, value);
              return q;
            },
          };
          callback(q);
          return builder;
        },
      };
      function matches(row: Record<string, any>) {
        return [...filters].every(([field, value]) => row[field] === value);
      }
      return builder;
    },
  };
  return {
    ctx: {
      db,
      scheduler: {
        runAfter: (delay: number, _reference: unknown, args: any) => {
          scheduled.push({ args, delay });
        },
      },
    },
    paginatedTables,
    scheduled,
    tables,
  };
}

describe("bounded workflow nudge pages", () => {
  test("uses the supplied clock and only probes the page's linked Job Cards", async () => {
    const queried: string[] = [];
    const ctx = {
      db: {
        query(table: string) {
          queried.push(table);
          return {
            withIndex(_name: string, callback: (q: { eq: () => unknown }) => unknown) {
              const q = { eq: () => q };
              callback(q);
              return { first: async () => null };
            },
          };
        },
      },
    };

    const risks = await collectRiskItemsPage(
      ctx,
      "queries",
      [
        {
          _id: "query_1",
          clientName: "A Traveller",
          contractingOwnerId: undefined,
          createdAt: referenceNow - 25 * 60 * 60 * 1000,
          queryCode: "Q-001",
          salesStatus: "Proposal in discussion",
        },
      ],
      referenceNow
    );

    expect(risks).toEqual([
      {
        body: "Q-001 has no Contracting SPOC after 24 hours.",
        entityId: "query_1",
        entityType: "query",
        ruleKey: "query_without_contracting_owner_after_24h",
        title: "Query needs Contracting SPOC",
      },
    ]);
    expect(queried).toEqual(["jobCards"]);
  });

  test("does not collect the entire CRM tables in the page evaluator", async () => {
    const source = await readFile(new URL("./workflowNudges.ts", import.meta.url), "utf8");
    expect(source).not.toContain('query("queries").collect()');
    expect(source).not.toContain('query("jobCards").collect()');
    expect(source).not.toContain('query("travellers").collect()');
    expect(source).not.toContain('query("tickets").collect()');
    expect(source).not.toContain('query("invoices").collect()');
  });

  test("advances durable stages with one continuation token and completes successfully", async () => {
    const { ctx, scheduled, tables } = makeRunCtx();

    let result = await runNudgePage(ctx, "scheduled", referenceNow);
    expect(result.status).toBe("running");
    expect(tables.portalWorkflowNudgeRuns[0]).toMatchObject({
      continuationToken: 2,
      stage: "jobCards",
      status: "running",
    });
    for (const expectedStage of ["tickets", "invoices", "complete"]) {
      const continuationToken = scheduled.at(-1)?.args.continuationToken;
      // biome-ignore lint/performance/noAwaitInLoops: each page requires the prior durable token
      result = await runNudgePage(ctx, "scheduled", referenceNow, continuationToken);
      expect(tables.portalWorkflowNudgeRuns[0].stage).toBe(expectedStage);
    }

    expect(result).toEqual({ checked: 0, sent: 0, status: "completed" });
    expect(tables.portalWorkflowNudgeRuns[0]).toMatchObject({
      checked: 0,
      cursor: null,
      sent: 0,
      stage: "complete",
      status: "completed",
    });
  });

  test("denies overlapping and stale continuation attempts without processing another page", async () => {
    const { ctx, paginatedTables, scheduled, tables } = makeRunCtx();
    await runNudgePage(ctx, "scheduled", referenceNow);
    const pagesAfterStart = paginatedTables.length;
    const schedulesAfterStart = scheduled.length;

    expect(await runNudgePage(ctx, "scheduled", referenceNow)).toEqual({
      checked: 0,
      sent: 0,
      status: "running",
    });
    expect(await runNudgePage(ctx, "scheduled", referenceNow, 1)).toEqual({
      checked: 0,
      sent: 0,
      status: "running",
    });
    expect(paginatedTables).toHaveLength(pagesAfterStart);
    expect(scheduled).toHaveLength(schedulesAfterStart);
    expect(tables.portalWorkflowNudgeRuns[0].stage).toBe("jobCards");
  });

  test("persists bounded deterministic and transient failure diagnostics", async () => {
    const deterministic = makeRunCtx({
      failure: { error: new Error("Invalid workflow rule payload"), table: "queries" },
    });
    expect(await runNudgePage(deterministic.ctx, "scheduled", referenceNow)).toEqual({
      checked: 0,
      sent: 0,
      status: "failed",
    });
    expect(deterministic.tables.portalWorkflowNudgeRuns[0]).toMatchObject({
      cursor: null,
      failureCode: "Error",
      failureKind: "deterministic",
      failureMessage: "Invalid workflow rule payload",
      retryCount: 0,
      stage: "queries",
      status: "failed",
    });

    const transient = makeRunCtx({
      failure: {
        error: new Error(`429 temporarily unavailable ${"x".repeat(700)}`),
        table: "queries",
      },
    });
    await runNudgePage(transient.ctx, "scheduled", referenceNow);
    expect(transient.tables.portalWorkflowNudgeRuns[0].failureKind).toBe("transient");
    expect(transient.tables.portalWorkflowNudgeRuns[0].failureMessage.length).toBe(500);
    expect(classifyNudgeFailure(new Error("network timeout"))).toMatchObject({
      kind: "transient",
    });
  });

  test("classifies a stale active run without scheduling a duplicate", async () => {
    const initialRun = {
      checked: 50,
      continuationToken: 7,
      cursor: "next-page",
      key: "scheduled",
      referenceNow,
      retryCount: 0,
      sent: 2,
      stage: "jobCards",
      startedAt: referenceNow - 60 * 60 * 1000,
      status: "running",
      updatedAt: referenceNow - 16 * 60 * 1000,
    };
    const { ctx, paginatedTables, scheduled, tables } = makeRunCtx({ initialRun });
    expect(isNudgeRunStale(tables.portalWorkflowNudgeRuns[0], referenceNow)).toBe(true);

    const result = await runNudgePage(ctx, "scheduled", referenceNow, 7);
    expect(result.status).toBe("stale");
    expect(tables.portalWorkflowNudgeRuns[0]).toMatchObject({
      failureCode: "STALE_RUN",
      failureKind: "stale",
      status: "stale",
    });
    expect(paginatedTables).toHaveLength(0);
    expect(scheduled).toHaveLength(0);
    expect(await classifyStaleNudgeRunState(ctx, "scheduled", referenceNow)).toMatchObject({
      status: "stale",
    });
  });

  test("retries failed progress once, preserves its cursor, and enforces the retry bound", async () => {
    const initialRun = {
      checked: 75,
      continuationToken: 4,
      cursor: "cursor-75",
      failedAt: referenceNow - 1000,
      failureCode: "Error",
      failureKind: "deterministic",
      failureMessage: "Poison item",
      key: "manual:operator",
      referenceNow,
      retryCount: 0,
      sent: 3,
      stage: "tickets",
      startedAt: referenceNow - 60_000,
      status: "failed",
      updatedAt: referenceNow - 1000,
    };
    const { ctx, scheduled, tables } = makeRunCtx({ initialRun });
    const retried = await retryNudgeRunState(ctx, "manual:operator", referenceNow);
    expect(retried).toMatchObject({
      checked: 75,
      continuationToken: 5,
      cursor: "cursor-75",
      retryCount: 1,
      sent: 3,
      stage: "tickets",
      status: "running",
    });
    expect(scheduled).toEqual([
      {
        args: { continuationToken: 5, runKey: "manual:operator" },
        delay: 0,
      },
    ]);

    await retryNudgeRunState(ctx, "manual:operator", referenceNow + 1);
    expect(scheduled).toHaveLength(1);

    Object.assign(tables.portalWorkflowNudgeRuns[0], { retryCount: 3, status: "failed" });
    await expect(retryNudgeRunState(ctx, "manual:operator", referenceNow + 2)).rejects.toThrow(
      "NUDGE_RETRY_LIMIT"
    );
  });

  test("uses the persisted rule ledger to skip an already-emitted nudge on resume", async () => {
    const { ctx } = makeRunCtx({
      ruleRun: {
        entityId: "query_1",
        entityType: "query",
        lastTriggeredAt: referenceNow,
        ruleKey: "confirmed_query_without_job_card",
      },
    });
    const item = {
      entityId: "query_1",
      entityType: "query",
      ruleKey: "confirmed_query_without_job_card",
    };

    expect(await shouldTrigger(ctx, item, 24, referenceNow + 1000)).toBe(false);
    expect(await shouldTrigger(ctx, item, 24, referenceNow + 25 * 60 * 60 * 1000)).toBe(true);
  });

  test("denies explicit retry to staff without workflow-rule authority", async () => {
    const staff = {
      _id: "staff_sales",
      active: true,
      authUserId: "auth_sales",
      email: "sales@example.com",
      name: "Sales User",
      roles: ["Sales"],
    };
    const ctx = {
      auth: {
        getUserIdentity: () => ({ email: staff.email, subject: staff.authUserId }),
      },
      db: {
        query: (table: string) => {
          expect(table).toBe("staffUsers");
          return {
            withIndex: (_name: string, callback: (q: any) => unknown) => {
              const q = { eq: () => q };
              callback(q);
              return { take: () => [staff] };
            },
          };
        },
      },
    };

    await expect((retryNudgeRun as any)._handler(ctx, { runKey: "scheduled" })).rejects.toThrow(
      "FORBIDDEN"
    );
  });
});
