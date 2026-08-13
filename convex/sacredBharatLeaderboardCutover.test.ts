import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { assertMatchesRegisteredReturnContract } from "./crm/validateReturnContract";
import {
  backfillSacredBharatLeaderboard,
  getSacredBharatLeaderboardMigrationStatus,
  verifySacredBharatLeaderboard,
} from "./migrations";
import { getLeaderboard } from "./sacredBharat";

interface Row {
  _id: string;
  [key: string]: unknown;
}

function queryContext(initial: Record<string, Row[]>) {
  const tables = Object.fromEntries(
    Object.entries(initial).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
  ) as Record<string, Row[]>;
  const ctx = {
    auth: { getUserIdentity: async () => null },
    db: {
      get: async (_table: string, id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === id);
          if (row) {
            return row;
          }
        }
        return null;
      },
      insert: async (table: string, value: Record<string, unknown>) => {
        const id = `${table}_${(tables[table]?.length ?? 0) + 1}`;
        tables[table] ||= [];
        tables[table].push({ _creationTime: Date.now(), _id: id, ...value });
        return id;
      },
      patch: async (_table: string, id: string, value: Record<string, unknown>) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === id);
          if (row) {
            Object.assign(row, value);
            return;
          }
        }
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
          paginate: async ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
            const start = cursor ? Number(cursor) : 0;
            const page = rows.slice(start, start + numItems);
            const next = start + page.length;
            return {
              continueCursor: String(next),
              isDone: next >= rows.length,
              page,
            };
          },
          take: async (limit: number) => rows.slice(0, limit),
          unique: async () => rows[0] ?? null,
          withIndex: (_name: string, callback?: (query: any) => unknown) => {
            if (callback) {
              const filters: Array<{ field: string; value: unknown }> = [];
              const index = {
                eq: (field: string, value: unknown) => {
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
  };
  return { ctx, tables };
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

    const result = await (getLeaderboard as any)._handler(ctx, { limit: 50 });

    expect(result.map((entry: { displayName: string }) => entry.displayName)).toEqual([
      "Materialized Yatri",
    ]);
  });

  test("persists backfill progress and verifies in a separate residual scan", async () => {
    setSystemTime(new Date("2026-08-05T12:00:00.000Z"));
    process.env.MIGRATION_SECRET = "migration-secret";
    const { ctx, tables } = queryContext({
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

    const firstBackfill = await (backfillSacredBharatLeaderboard as any)._handler(ctx, {
      limit: 1,
      secret: "migration-secret",
    });
    assertMatchesRegisteredReturnContract(backfillSacredBharatLeaderboard, firstBackfill);
    expect(firstBackfill).toMatchObject({ cursor: "1", stage: "backfill", status: "running" });
    expect(tables.sacredBharatLeaderboardSummaries).toHaveLength(1);

    const secondBackfill = await (backfillSacredBharatLeaderboard as any)._handler(ctx, {
      limit: 1,
      secret: "migration-secret",
    });
    assertMatchesRegisteredReturnContract(backfillSacredBharatLeaderboard, secondBackfill);
    expect(secondBackfill).toMatchObject({ cursor: null, stage: "verify", status: "running" });
    expect(tables.sacredBharatLeaderboardSummaries).toHaveLength(2);

    const firstVerification = await (verifySacredBharatLeaderboard as any)._handler(ctx, {
      limit: 1,
      secret: "migration-secret",
    });
    assertMatchesRegisteredReturnContract(verifySacredBharatLeaderboard, firstVerification);
    expect(firstVerification).toMatchObject({ cursor: "1", stage: "verify", status: "running" });

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
    const fallback = await (getLeaderboard as any)._handler(ctx, { limit: 50 });
    expect(fallback[0].displayName).toBe("Missing Yatri");
  });
});
