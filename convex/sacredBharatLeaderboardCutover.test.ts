import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import type { FunctionReference } from "convex/server";
import { assertMatchesRegisteredReturnContract } from "./crm/validateReturnContract";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";
import { sacredBharatLeaderboardRanks } from "./lib/sacredBharatLeaderboardRank";
import {
  backfillSacredBharatLeaderboard,
  getSacredBharatLeaderboardMigrationStatus,
  verifySacredBharatLeaderboard,
} from "./migrations";
import { getLeaderboard, getMyLeaderboardRank } from "./sacredBharat";
import {
  backfillLeaderboardRanks,
  verifyLeaderboardRanks,
} from "./sacredBharatLeaderboardRankMigration";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}

function queryContext(initial: Record<string, Row[]>) {
  const tables = Object.fromEntries(
    Object.entries(initial).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
  );
  const componentMutations: RuntimeObject[] = [];
  const ctx = {
    auth: { getUserIdentity: async () => null },
    db: {
      get: (_table: string, id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === id);
          if (row) {
            return Promise.resolve(row);
          }
        }
        return Promise.resolve(null);
      },
      insert: (table: string, value: RuntimeObject) => {
        const id = `${table}_${(tables[table]?.length ?? 0) + 1}`;
        tables[table] ||= [];
        tables[table].push({ _creationTime: Date.now(), _id: id, ...value });
        return Promise.resolve(id);
      },
      patch: (_table: string, id: string, value: RuntimeObject) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === id);
          if (row) {
            Object.assign(row, value);
            return Promise.resolve();
          }
        }
        return Promise.resolve();
      },
      query: (table: string) => {
        let rows = [...(tables[table] ?? [])];
        const builder = {
          collect: async () => rows,
          first: async () => rows[0] ?? null,
          order: (direction: "asc" | "desc") => {
            rows.sort((left, right) => {
              const leftValue = Number(left.score ?? left._creationTime ?? left.visitedAt ?? 0);
              const rightValue = Number(right.score ?? right._creationTime ?? right.visitedAt ?? 0);
              return direction === "desc" ? rightValue - leftValue : leftValue - rightValue;
            });
            return builder;
          },
          paginate: ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
            const start = cursor ? Number(cursor) : 0;
            const page = rows.slice(start, start + numItems);
            const next = start + page.length;
            return Promise.resolve({
              continueCursor: String(next),
              isDone: next >= rows.length,
              page,
            });
          },
          take: async (limit: number) => rows.slice(0, limit),
          unique: async () => rows[0] ?? null,
          withIndex: (_name: string, callback?: (query: any) => RuntimeValue) => {
            if (callback) {
              const filters: Array<{ field: string; value: unknown }> = [];
              const index = {
                eq: (field: string, value: RuntimeValue) => {
                  filters.push({ field, value });
                  return index;
                },
              };
              callback(index);
              rows = rows.filter((row) =>
                filters.every((filter) => row[filter.field] === filter.value)
              );
            }
            return builder;
          },
        };
        return builder;
      },
    },
    runMutation: (
      _reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">,
      args: RuntimeObject
    ) => {
      componentMutations.push(args);
      return Promise.resolve(null);
    },
  };
  return { componentMutations, ctx, tables };
}

afterEach(() => {
  setSystemTime();
  delete process.env.MIGRATION_SECRET;
});

describe("Sacred Bharat leaderboard cutover", () => {
  test("merges materialized and legacy participants until readiness is verified", async () => {
    const { ctx } = queryContext({
      dataMigrationRegistry: [],
      sacredBharatLeaderboardSummaries: [
        {
          _id: "summary_1",
          authUserId: "auth_materialized",
          completedTrailCount: 3,
          displayName: "Materialized Yatri",
          levelSlug: "jyotirlinga-yatri",
          levelTitle: "Jyotirlinga Yatri",
          optedOut: false,
          passportSlug: null,
          score: 999,
          templeCount: 12,
          updatedAt: 1,
        },
      ],
      sacredBharatProfiles: [],
      sacredBharatVisits: [
        {
          _id: "visit_1",
          authUserId: "auth_materialized",
          templeId: "kedarnath",
          visitedAt: 1,
        },
        {
          _id: "visit_2",
          authUserId: "auth_legacy",
          templeId: "badrinath",
          visitedAt: 2,
        },
      ],
      userProfiles: [
        {
          _id: "profile_legacy",
          authUserId: "auth_legacy",
          name: "Legacy Yatri",
        },
      ],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await (getLeaderboard as any)._handler(ctx, { limit: 50 });

    assertMatchesRegisteredReturnContract(getLeaderboard, result);
    expect(result.map((entry: { displayName: string }) => entry.displayName)).toEqual([
      "Materialized Yatri",
      "Legacy Yatri",
    ]);
    expect(result[0].score).toBe(999);
  });

  test("uses materialized-only reads only after verified readiness", async () => {
    const { ctx } = queryContext({
      dataMigrationRegistry: [
        {
          _id: "migration_1",
          converted: 1,
          cursor: null,
          key: "sacred-bharat-leaderboard-v1",
          legacyRemaining: 0,
          processed: 1,
          stage: "complete",
          startedAt: 1,
          status: "verified",
          updatedAt: 1,
          verifiedAt: 1,
        },
      ],
      sacredBharatLeaderboardSummaries: [
        {
          _id: "summary_1",
          authUserId: "auth_materialized",
          completedTrailCount: 0,
          displayName: "Materialized Yatri",
          levelSlug: "seeker",
          levelTitle: "Seeker",
          optedOut: false,
          passportSlug: null,
          score: 10,
          templeCount: 1,
          updatedAt: 1,
        },
      ],
      sacredBharatProfiles: [],
      sacredBharatVisits: [
        {
          _id: "visit_legacy",
          authUserId: "auth_legacy",
          templeId: "badrinath",
          visitedAt: 2,
        },
      ],
      userProfiles: [{ _id: "profile_legacy", authUserId: "auth_legacy", name: "Legacy" }],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await (getLeaderboard as any)._handler(ctx, { limit: 50 });

    expect(result.map((entry: { displayName: string }) => entry.displayName)).toEqual([
      "Materialized Yatri",
    ]);
  });

  test("persists backfill progress and verifies in a separate residual scan", async () => {
    setSystemTime(new Date("2026-08-05T12:00:00.000Z"));
    process.env.MIGRATION_SECRET = "migration-secret";
    const { componentMutations, ctx, tables } = queryContext({
      dataMigrationRegistry: [],
      sacredBharatLeaderboardSummaries: [],
      sacredBharatProfiles: [],
      sacredBharatVisits: [
        {
          _creationTime: 1,
          _id: "visit_1",
          authUserId: "auth_1",
          templeId: "kedarnath",
          visitedAt: 1,
        },
        {
          _creationTime: 2,
          _id: "visit_2",
          authUserId: "auth_2",
          templeId: "badrinath",
          visitedAt: 2,
        },
      ],
      userProfiles: [
        { _id: "profile_1", authUserId: "auth_1", name: "First Yatri" },
        { _id: "profile_2", authUserId: "auth_2", name: "Second Yatri" },
      ],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const firstBackfill = await (backfillSacredBharatLeaderboard as any)._handler(ctx, {
      limit: 1,
      secret: "migration-secret",
    });
    assertMatchesRegisteredReturnContract(backfillSacredBharatLeaderboard, firstBackfill);
    expect(firstBackfill).toMatchObject({ cursor: "1", stage: "backfill", status: "running" });
    expect(tables.sacredBharatLeaderboardSummaries).toHaveLength(1);
    expect(componentMutations).toHaveLength(1);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const secondBackfill = await (backfillSacredBharatLeaderboard as any)._handler(ctx, {
      limit: 1,
      secret: "migration-secret",
    });
    assertMatchesRegisteredReturnContract(backfillSacredBharatLeaderboard, secondBackfill);
    expect(secondBackfill).toMatchObject({ cursor: null, stage: "verify", status: "running" });
    expect(tables.sacredBharatLeaderboardSummaries).toHaveLength(2);
    expect(componentMutations).toHaveLength(2);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const firstVerification = await (verifySacredBharatLeaderboard as any)._handler(ctx, {
      limit: 1,
      secret: "migration-secret",
    });
    assertMatchesRegisteredReturnContract(verifySacredBharatLeaderboard, firstVerification);
    expect(firstVerification).toMatchObject({ cursor: "1", stage: "verify", status: "running" });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const secondVerification = await (verifySacredBharatLeaderboard as any)._handler(ctx, {
      limit: 1,
      secret: "migration-secret",
    });
    assertMatchesRegisteredReturnContract(verifySacredBharatLeaderboard, secondVerification);
    expect(secondVerification).toMatchObject({
      cursor: null,
      legacyRemaining: 0,
      stage: "complete",
      status: "verified",
    });
    expect(tables.dataMigrationRegistry[0]).toMatchObject({
      cursor: null,
      legacyRemaining: 0,
      stage: "complete",
      status: "verified",
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const status = await (getSacredBharatLeaderboardMigrationStatus as any)._handler(ctx, {
      secret: "migration-secret",
    });
    assertMatchesRegisteredReturnContract(getSacredBharatLeaderboardMigrationStatus, status);
    expect(status).toMatchObject({ legacyRemaining: 0, verified: true });
  });

  test("fails readiness when the independent scan finds a missing summary", async () => {
    process.env.MIGRATION_SECRET = "migration-secret";
    const { ctx, tables } = queryContext({
      dataMigrationRegistry: [
        {
          _id: "migration_1",
          converted: 0,
          cursor: null,
          key: "sacred-bharat-leaderboard-v1",
          legacyRemaining: 0,
          processed: 0,
          stage: "verify",
          startedAt: 1,
          status: "running",
          updatedAt: 1,
        },
      ],
      sacredBharatLeaderboardSummaries: [],
      sacredBharatProfiles: [],
      sacredBharatVisits: [
        {
          _creationTime: 1,
          _id: "visit_missing",
          authUserId: "auth_missing",
          templeId: "kedarnath",
          visitedAt: 1,
        },
      ],
      userProfiles: [{ _id: "profile_missing", authUserId: "auth_missing", name: "Missing Yatri" }],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const verification = await (verifySacredBharatLeaderboard as any)._handler(ctx, {
      limit: 10,
      secret: "migration-secret",
    });

    expect(verification).toMatchObject({ legacyRemaining: 1, stage: "verify", status: "failed" });
    expect(tables.dataMigrationRegistry[0]).toMatchObject({
      legacyRemaining: 1,
      stage: "verify",
      status: "failed",
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const fallback = await (getLeaderboard as any)._handler(ctx, { limit: 50 });
    expect(fallback[0].displayName).toBe("Missing Yatri");
  });

  test("uses the verified rank projection for bounded top and exact current rank reads", async () => {
    const summaries = [
      {
        _id: "summary_a",
        authUserId: "auth_a",
        completedTrailCount: 3,
        displayName: "A Yatri",
        levelSlug: "seeker",
        levelTitle: "Seeker",
        optedOut: false,
        passportSlug: null,
        score: 900,
        templeCount: 9,
        updatedAt: 1,
      },
      {
        _id: "summary_b",
        authUserId: "auth_b",
        completedTrailCount: 2,
        displayName: "B Yatri",
        levelSlug: "seeker",
        levelTitle: "Seeker",
        optedOut: false,
        passportSlug: "b-yatri",
        score: 800,
        templeCount: 8,
        updatedAt: 1,
      },
    ];
    const { ctx } = queryContext({
      authIdentityLinks: [],
      dataMigrationRegistry: [
        {
          _id: "rank_registry",
          converted: 2,
          cursor: null,
          key: "sacred-bharat-leaderboard-rank-v1",
          legacyRemaining: 0,
          processed: 2,
          stage: "complete",
          startedAt: 1,
          status: "verified",
          updatedAt: 1,
          verifiedAt: 1,
        },
      ],
      sacredBharatLeaderboardSummaries: summaries,
    });
    ctx.auth.getUserIdentity = async () => ({ subject: "auth_b" });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const aggregate = sacredBharatLeaderboardRanks as any;
    const original = {
      count: aggregate.count,
      indexOfDoc: aggregate.indexOfDoc,
      paginate: aggregate.paginate,
    };
    aggregate.paginate = async (_ctx: typeof ctx, options: { pageSize: number }) => ({
      cursor: "done",
      isDone: true,
      page: summaries
        .slice(0, options.pageSize)
        .map((summary) => ({ id: summary._id, key: [], sumValue: 0 })),
    });
    aggregate.count = async () => summaries.length;
    aggregate.indexOfDoc = async (_ctx: typeof ctx, summary: Row) =>
      summaries.findIndex((candidate) => candidate._id === summary._id);

    try {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const leaderboard = await (getLeaderboard as any)._handler(ctx, { limit: 2 });
      expect(leaderboard.map(({ displayName }: Row) => displayName)).toEqual([
        "A Yatri",
        "B Yatri",
      ]);
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const myRank = await (getMyLeaderboardRank as any)._handler(ctx, {});
      expect(myRank).toMatchObject({ rank: 2, totalPlayers: 2 });
    } finally {
      Object.assign(aggregate, original);
    }
  });

  test("backfills and independently verifies the ordered rank component", async () => {
    process.env.MIGRATION_SECRET = "rank-secret";
    const summaries = [
      {
        _id: "summary_visible",
        authUserId: "auth_visible",
        displayName: "Visible",
        optedOut: false,
        score: 100,
        templeCount: 1,
      },
      {
        _id: "summary_hidden",
        authUserId: "auth_hidden",
        displayName: "Hidden",
        optedOut: true,
        score: 200,
        templeCount: 2,
      },
    ];
    const { ctx, tables } = queryContext({
      dataMigrationRegistry: [
        {
          _id: "summary_registry",
          converted: 2,
          cursor: null,
          key: "sacred-bharat-leaderboard-v1",
          legacyRemaining: 0,
          processed: 2,
          stage: "complete",
          startedAt: 1,
          status: "verified",
          updatedAt: 1,
          verifiedAt: 1,
        },
      ],
      sacredBharatLeaderboardSummaries: summaries,
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const aggregate = sacredBharatLeaderboardRanks as any;
    const original = {
      at: aggregate.at,
      count: aggregate.count,
      indexOfDoc: aggregate.indexOfDoc,
      insertIfDoesNotExist: aggregate.insertIfDoesNotExist,
    };
    const byNamespace = {
      eligible: [summaries[0]],
      hidden: [summaries[1]],
    } satisfies Record<string, Row[]>;
    aggregate.insertIfDoesNotExist = async () => undefined;
    aggregate.indexOfDoc = async () => 0;
    aggregate.at = async (_ctx: typeof ctx, offset: number, options: { namespace: string }) => ({
      id: byNamespace[options.namespace][offset]._id,
      key: [],
      sumValue: 0,
    });
    aggregate.count = async (_ctx: typeof ctx, options: { namespace: string }) =>
      byNamespace[options.namespace].length;

    try {
      await expect(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        (backfillLeaderboardRanks as any)._handler(ctx, { secret: "rank-secret" })
      ).resolves.toMatchObject({ stage: "verify", status: "running" });
      await expect(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        (verifyLeaderboardRanks as any)._handler(ctx, { secret: "rank-secret" })
      ).resolves.toMatchObject({ legacyRemaining: 0, stage: "complete", status: "verified" });
      expect(
        tables.dataMigrationRegistry.find((row) => row.key === "sacred-bharat-leaderboard-rank-v1")
      ).toMatchObject({ legacyRemaining: 0, status: "verified" });
    } finally {
      Object.assign(aggregate, original);
    }
  });
});
