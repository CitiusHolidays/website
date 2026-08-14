import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  classifyNudgeFailure,
  classifyStaleNudgeRunState,
  isNudgeRunStale,
  isScheduledNudgeCadenceEligible,
  nudgeRetryDelayMs,
  presentNudgeRun,
  retryNudgeRunState,
  runNudgePage as runNudgeRunPage,
  WORKFLOW_NUDGE_REPEAT_HOURS,
} from "./workflowNudgeRun";
import {
  collectRiskItemsPage,
  effectiveWorkflowRulesFromRows,
  retryNudgeRun,
  runNudgePage,
  shouldTrigger,
  validateWorkflowThresholdHours,
} from "./workflowNudges";

const referenceNow = Date.parse("2026-08-01T12:00:00.000Z");

function makeRunCtx({
  failure,
  initialRun,
  ruleRun,
  tableRows,
}: {
  failure?: { error: Error; table: string };
  initialRun?: Record<string, any>;
  ruleRun?: Record<string, any>;
  tableRows?: Record<string, any[]>;
} = {}) {
  let idSequence = 0;
  const scheduled: Array<{ args: any; delay: number }> = [];
  const paginatedTables: string[] = [];
  const tables: Record<string, any[]> = {
    invoices: [],
    jobCards: [],
    portalWorkflowNudgeRuns: initialRun ? [{ _id: "run_1", ...initialRun }] : [],
    portalWorkflowRuleRuns: ruleRun ? [{ _id: "rule_run_1", ...ruleRun }] : [],
    portalWorkflowRules: [],
    queries: [],
    tickets: [],
    travellers: [],
    ...tableRows,
  };
  const db = {
    get: (_table: string, id: string) =>
      Object.values(tables)
        .flat()
        .find((row) => row._id === id) ?? null,
    insert: (table: string, value: Record<string, any>) => {
      idSequence += 1;
      const id = `${table}_${idSequence}`;
      tables[table] ??= [];
      tables[table].push({ _id: id, ...value });
      return id;
    },
    patch: (
      tableOrId: string,
      idOrPatch: string | Record<string, any>,
      maybePatch?: Record<string, any>
    ) => {
      const id = maybePatch ? (idOrPatch as string) : tableOrId;
      const patch = maybePatch ?? (idOrPatch as Record<string, any>);
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
        take: (limit: number) => (tables[table] ?? []).filter(matches).slice(0, limit),
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

async function drainScheduledRun(
  ctx: any,
  scheduled: Array<{ args: any }>,
  current: Awaited<ReturnType<typeof runNudgePage>>
): Promise<Awaited<ReturnType<typeof runNudgePage>>> {
  if (current.status !== "running") {
    return current;
  }
  const continuationToken = scheduled.at(-1)?.args.continuationToken;
  const next = await runNudgePage(ctx, "scheduled", referenceNow, continuationToken);
  return await drainScheduledRun(ctx, scheduled, next);
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

  test("uses the configured detection threshold and keeps repeat cadence separate", async () => {
    const rules = effectiveWorkflowRulesFromRows([
      {
        enabled: true,
        key: "query_without_contracting_owner_after_24h",
        thresholdHours: 48,
      },
    ]);
    const ctx = {
      db: {
        query: () => ({
          withIndex: (_name: string, callback: (q: { eq: () => unknown }) => unknown) => {
            const q = { eq: () => q };
            callback(q);
            return { first: () => null };
          },
        }),
      },
    };
    const row = {
      _id: "query_1",
      contractingOwnerId: undefined,
      createdAt: referenceNow - 47 * 60 * 60 * 1000,
      queryCode: "Q-001",
      salesStatus: "Proposal in discussion",
    };

    expect(await collectRiskItemsPage(ctx, "queries", [row], referenceNow, rules)).toEqual([]);
    row.createdAt -= 60 * 60 * 1000;
    expect(await collectRiskItemsPage(ctx, "queries", [row], referenceNow, rules)).toEqual([
      expect.objectContaining({ body: "Q-001 has no Contracting SPOC after 48 hours." }),
    ]);
    expect(WORKFLOW_NUDGE_REPEAT_HOURS).toBe(24);
  });

  test("rejects invalid workflow thresholds with a named error", () => {
    expect(validateWorkflowThresholdHours(0)).toBe(0);
    expect(validateWorkflowThresholdHours(720)).toBe(720);
    for (const value of [-1, 721, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validateWorkflowThresholdHours(value)).toThrow("INVALID_WORKFLOW_THRESHOLD");
    }
  });

  test("detects only canonical passport departure blockers without exposing traveller data", async () => {
    const job = {
      _id: "job_1",
      jobCode: "JC-0001-NS",
      travelStartDate: "2026-09-01",
    };
    const ctx = { db: { get: () => job } };
    const risks = await collectRiskItemsPage(
      ctx,
      "travellers",
      [
        {
          _id: "traveller_1",
          fullName: "Private Name",
          jobCardId: job._id,
          passportExpiryDate: "2027-02-01",
          ticketStatus: "Issued",
          visaStatus: "Approved",
        },
        {
          _id: "traveller_2",
          fullName: "Another Private Name",
          jobCardId: job._id,
          passportExpiryDate: "2028-02-01",
          ticketStatus: "Issued",
          visaStatus: "Approved",
        },
      ],
      referenceNow
    );

    expect(risks).toEqual([
      {
        body: "JC-0001-NS has passport validity that blocks departure readiness.",
        entityId: "job_1",
        entityType: "jobCard",
        ruleKey: "passport_expiry_blocks_departure",
        title: "Passport validity blocks departure",
      },
    ]);
    expect(JSON.stringify(risks)).not.toContain("Private Name");
    expect(JSON.stringify(risks)).not.toContain("2027-02-01");
  });

  test("drains more than 500 Travellers through bounded pages", async () => {
    const job = {
      _id: "job_1",
      jobCode: "JC-0001-NS",
      travelStartDate: "2026-09-01",
    };
    const travellers = Array.from({ length: 501 }, (_, index) => ({
      _id: `traveller_${index}`,
      jobCardId: job._id,
      passportExpiryDate: "2028-01-01",
      ticketStatus: "Issued",
      visaStatus: "Approved",
    }));
    const { ctx, paginatedTables, scheduled, tables } = makeRunCtx({
      tableRows: { jobCards: [job], travellers },
    });

    const started = await runNudgePage(ctx, "scheduled", referenceNow);
    const result = await drainScheduledRun(ctx, scheduled, started);

    expect(result.status).toBe("completed");
    expect(paginatedTables.filter((table) => table === "travellers")).toHaveLength(11);
    expect(tables.portalWorkflowNudgeRuns[0].checked).toBe(502);
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
    for (const expectedStage of ["travellers", "tickets", "invoices", "complete"]) {
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
    expect(await runNudgePage(transient.ctx, "scheduled", referenceNow)).toEqual({
      checked: 0,
      sent: 0,
      status: "running",
    });
    expect(transient.tables.portalWorkflowNudgeRuns[0].failureKind).toBe("transient");
    expect(transient.tables.portalWorkflowNudgeRuns[0].failureMessage.length).toBe(500);
    expect(transient.scheduled).toEqual([
      {
        args: { continuationToken: 2, runKey: "scheduled" },
        delay: nudgeRetryDelayMs(0),
      },
    ]);
    expect(classifyNudgeFailure(new Error("network timeout"))).toMatchObject({
      kind: "transient",
    });
  });

  test("caps automatic transient backoff before exposing terminal failure", async () => {
    const { ctx, scheduled, tables } = makeRunCtx({
      failure: { error: new Error("network timeout"), table: "queries" },
    });

    let result = await runNudgePage(ctx, "scheduled", referenceNow);
    for (let retry = 1; retry <= 3; retry += 1) {
      const continuationToken = scheduled.at(-1)?.args.continuationToken;
      // biome-ignore lint/performance/noAwaitInLoops: each retry requires the prior durable token
      result = await runNudgePage(
        ctx,
        "scheduled",
        referenceNow + nudgeRetryDelayMs(retry - 1),
        continuationToken
      );
    }

    expect(result.status).toBe("failed");
    expect(scheduled.map((item) => item.delay)).toEqual([
      nudgeRetryDelayMs(0),
      nudgeRetryDelayMs(1),
      nudgeRetryDelayMs(2),
    ]);
    expect(tables.portalWorkflowNudgeRuns[0]).toMatchObject({
      consecutiveFailedRuns: 1,
      failureKind: "transient",
      retryCount: 3,
      status: "failed",
    });
  });

  test("starts a fresh scheduled generation on the next cadence and retains failure summary", async () => {
    const initialRun = {
      checked: 50,
      consecutiveFailedRuns: 2,
      continuationToken: 7,
      cursor: "next-page",
      failedAt: referenceNow + 1000,
      failureCode: "Error",
      failureKind: "deterministic",
      failureMessage: "Poison item",
      key: "scheduled",
      referenceNow,
      retryCount: 3,
      sent: 2,
      stage: "queries",
      startedAt: referenceNow,
      status: "failed",
      updatedAt: referenceNow + 1000,
    };
    const { ctx, paginatedTables, tables } = makeRunCtx({ initialRun });

    expect(
      isScheduledNudgeCadenceEligible(initialRun, referenceNow + 24 * 60 * 60 * 1000 - 1)
    ).toBe(false);
    expect(await runNudgePage(ctx, "scheduled", referenceNow + 24 * 60 * 60 * 1000 - 1)).toEqual({
      checked: 0,
      sent: 0,
      status: "failed",
    });
    expect(paginatedTables).toHaveLength(0);
    expect(presentNudgeRun(tables.portalWorkflowNudgeRuns[0], referenceNow)).toMatchObject({
      consecutiveFailedRuns: 2,
      healthStatus: "degraded",
    });

    const nextReference = referenceNow + 24 * 60 * 60 * 1000;
    expect(await runNudgePage(ctx, "scheduled", nextReference)).toMatchObject({
      status: "running",
    });
    expect(tables.portalWorkflowNudgeRuns[0]).toMatchObject({
      checked: 0,
      consecutiveFailedRuns: 2,
      previousFailedAt: referenceNow + 1000,
      previousFailureCode: "Error",
      previousFailureKind: "deterministic",
      retryCount: 0,
      stage: "jobCards",
      startedAt: nextReference,
      status: "running",
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

  test("counts a retried run generation at most once across successful pages", async () => {
    const startedAt = referenceNow - 60_000;
    const initialRun = {
      checked: 25,
      consecutiveFailedRuns: 1,
      continuationToken: 5,
      cursor: "cursor-25",
      failureCountedStartedAt: startedAt,
      key: "manual:operator",
      referenceNow,
      retryCount: 1,
      sent: 1,
      stage: "queries",
      startedAt,
      status: "running",
      updatedAt: referenceNow - 1000,
    };
    const { ctx, scheduled, tables } = makeRunCtx({ initialRun });

    expect(
      await runNudgeRunPage(
        ctx,
        "manual:operator",
        async () => ({ checked: 25, continueCursor: "", isDone: true, sent: 0 }),
        referenceNow,
        5
      )
    ).toMatchObject({ status: "running" });
    expect(tables.portalWorkflowNudgeRuns[0]).toMatchObject({
      consecutiveFailedRuns: 1,
      failureCountedStartedAt: startedAt,
      stage: "jobCards",
    });

    expect(
      await runNudgeRunPage(
        ctx,
        "manual:operator",
        () => Promise.reject(new Error("Invalid workflow rule payload")),
        referenceNow + 1,
        scheduled.at(-1)?.args.continuationToken
      )
    ).toMatchObject({ status: "failed" });
    expect(tables.portalWorkflowNudgeRuns[0]).toMatchObject({
      consecutiveFailedRuns: 1,
      failureCountedStartedAt: startedAt,
      status: "failed",
    });
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
