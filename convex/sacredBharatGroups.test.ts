import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";
import { propertiesWhen } from "./lib/runtimeValues";
import { makeInviteCode } from "./lib/sacredBharatInvites";
import {
  createGroup,
  getGroupLeaderboard,
  joinGroupByInviteCode,
  leaveGroup,
  listMyGroups,
} from "./sacredBharat";
import {
  backfillGroupMemberCounts,
  verifyGroupMemberCounts,
} from "./sacredBharatGroupMembershipMigration";

interface Row {
  _creationTime?: number;
  _id: string;
  [field: string]: RuntimeValue;
}

interface Tables {
  [table: string]: Row[];
}

function makeContext(initialTables: Tables, initialSubject = "auth_owner") {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [
      table,
      rows.map((row, index) => ({ _creationTime: index + 1, ...row })),
    ])
  );
  let subject = initialSubject;
  let nextId = 1000;
  const db = {
    delete: (_table: string, id: string) => {
      for (const table of Object.keys(tables)) {
        tables[table] = (tables[table] ?? []).filter((row) => row._id !== id);
      }
    },
    get: (_table: string, id: string) =>
      Object.values(tables)
        .flat()
        .find((row) => row._id === id) ?? null,
    insert: (table: string, value: RuntimeObject) => {
      const id = `${table}_${nextId}`;
      nextId += 1;
      tables[table] ??= [];
      tables[table].push({
        _creationTime: nextId,
        _id: id,
        ...value,
      });
      return id;
    },
    normalizeId: (table: string, id: string) =>
      (tables[table] ?? []).some((row) => row._id === id) ? id : null,
    patch: (_table: string, id: string, value: RuntimeObject) => {
      const row = Object.values(tables)
        .flat()
        .find((candidate) => candidate._id === id);
      if (!row) {
        throw new Error(`Missing row ${id}`);
      }
      Object.assign(row, value);
    },
    query: (table: string) => {
      let rows = [...(tables[table] ?? [])];
      const builder = {
        collect: async () => [...rows],
        first: async () => rows[0] ?? null,
        order: (direction: "asc" | "desc") => {
          rows.sort((left, right) =>
            direction === "asc"
              ? (left._creationTime ?? 0) - (right._creationTime ?? 0)
              : (right._creationTime ?? 0) - (left._creationTime ?? 0)
          );
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
        withIndex: (_name: string, callback: (query: any) => RuntimeValue) => {
          const filters: Array<{ field: string; value: unknown }> = [];
          const query = {
            eq: (field: string, value: RuntimeValue) => {
              filters.push({ field, value });
              return query;
            },
          };
          callback(query);
          rows = rows.filter((row) => filters.every(({ field, value }) => row[field] === value));
          return builder;
        },
      };
      return builder;
    },
  };
  return {
    ctx: {
      auth: { getUserIdentity: async () => ({ subject }) },
      db,
    },
    setSubject: (nextSubject: string) => {
      subject = nextSubject;
    },
    tables,
  };
}

function group(id: string, inviteCode = makeInviteCode(), memberCount?: number): Row {
  return {
    _id: id,
    createdAt: 1,
    inviteCode,
    isArchived: false,
    ...propertiesWhen(!(memberCount === undefined), () => ({ memberCount })),
    name: id,
    ownerAuthUserId: "auth_owner",
    updatedAt: 1,
  };
}

function member(id: string, groupId: string, authUserId: string, role = "member"): Row {
  return { _id: id, authUserId, groupId, joinedAt: 1, role };
}

const baseTables = (): Tables => ({
  authIdentityLinks: [],
  dataMigrationRegistry: [],
  sacredBharatGroupMembers: [],
  sacredBharatGroups: [],
  sacredBharatInviteAttempts: [],
  sacredBharatLeaderboardSummaries: [],
  sacredBharatProfiles: [],
  sacredBharatVisits: [],
  sacredBharatWishlist: [],
  userProfiles: [],
});

describe("Sacred Bharat private group bounds", () => {
  test("returns independent source counts before projection readiness", async () => {
    const tables = baseTables();
    tables.sacredBharatGroups = [group("group_a"), group("group_b")];
    tables.sacredBharatGroupMembers = [
      member("member_a_owner", "group_a", "auth_owner", "owner"),
      member("member_a_2", "group_a", "auth_two"),
      member("member_b_owner", "group_b", "auth_owner", "owner"),
      member("member_b_2", "group_b", "auth_two"),
      member("member_b_3", "group_b", "auth_three"),
    ];
    const { ctx } = makeContext(tables);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await (listMyGroups as any)._handler(ctx, {});
    expect(result.map(({ id, memberCount }: any) => [id, memberCount])).toEqual([
      ["group_a", 2],
      ["group_b", 3],
    ]);
  });

  test("maintains exact counts across create, replay-safe join, and leave", async () => {
    const tables = baseTables();
    const existingInvite = makeInviteCode();
    tables.sacredBharatGroups = [group("group_existing", existingInvite, 1)];
    tables.sacredBharatGroupMembers = [
      member("member_owner", "group_existing", "auth_owner", "owner"),
    ];
    const { ctx, setSubject, tables: state } = makeContext(tables);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const created = await (createGroup as any)._handler(ctx, { name: "Family journey" });
    const createdGroup = state.sacredBharatGroups.find((row) => row._id === created.id);
    expect(createdGroup?.memberCount).toBe(1);

    setSubject("auth_joiner");
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (joinGroupByInviteCode as any)._handler(ctx, { inviteCode: existingInvite })
    ).resolves.toEqual({ id: "group_existing" });
    expect(state.sacredBharatGroups[0].memberCount).toBe(2);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (joinGroupByInviteCode as any)._handler(ctx, { inviteCode: existingInvite });
    expect(state.sacredBharatGroups[0].memberCount).toBe(2);
    expect(
      state.sacredBharatGroupMembers.filter((row) => row.groupId === "group_existing")
    ).toHaveLength(2);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (leaveGroup as any)._handler(ctx, { groupId: "group_existing" });
    expect(state.sacredBharatGroups[0].memberCount).toBe(1);
  });

  test("rejects a first join when the exact 100-member limit is reached", async () => {
    const tables = baseTables();
    const inviteCode = makeInviteCode();
    tables.sacredBharatGroups = [group("group_full", inviteCode, 100)];
    tables.sacredBharatGroupMembers = Array.from({ length: 100 }, (_, index) =>
      member(`member_${index}`, "group_full", `auth_${index}`, index === 0 ? "owner" : "member")
    );
    const { ctx, tables: state } = makeContext(tables, "auth_new");

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await expect((joinGroupByInviteCode as any)._handler(ctx, { inviteCode })).resolves.toEqual({
      full: true,
      memberLimit: 100,
    });
    expect(state.sacredBharatGroupMembers).toHaveLength(100);
    expect(state.sacredBharatGroups[0].memberCount).toBe(100);
  });

  test("returns an exact bounded leaderboard with a deterministic final tie-break", async () => {
    const tables = baseTables();
    tables.sacredBharatGroups = [group("group_ranked", makeInviteCode(), 3)];
    tables.sacredBharatGroupMembers = [
      member("member_owner", "group_ranked", "auth_owner", "owner"),
      member("member_b", "group_ranked", "auth_b"),
      member("member_a", "group_ranked", "auth_a"),
    ];
    tables.sacredBharatLeaderboardSummaries = [
      {
        _id: "summary_owner",
        authUserId: "auth_owner",
        displayName: "Owner",
        levelTitle: "Seeker",
        passportSlug: null,
        score: 10,
        templeCount: 1,
      },
      {
        _id: "summary_b",
        authUserId: "auth_b",
        displayName: "Same",
        levelTitle: "Seeker",
        passportSlug: null,
        score: 20,
        templeCount: 2,
      },
      {
        _id: "summary_a",
        authUserId: "auth_a",
        displayName: "Same",
        levelTitle: "Seeker",
        passportSlug: null,
        score: 20,
        templeCount: 2,
      },
    ];
    const { ctx } = makeContext(tables);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await (getGroupLeaderboard as any)._handler(ctx, {
      groupId: "group_ranked",
    });
    expect(result.group.memberCount).toBe(3);
    expect(result.entries.map(({ authUserId, rank }: any) => [authUserId, rank])).toEqual([
      ["auth_a", 1],
      ["auth_b", 2],
      ["auth_owner", 3],
    ]);
    expect(result.entries[2].isCurrentUser).toBe(true);
  });

  test("denies nonmembers and keeps the registered leaderboard source collect-free", async () => {
    const tables = baseTables();
    tables.sacredBharatGroups = [group("group_private", makeInviteCode(), 1)];
    tables.sacredBharatGroupMembers = [
      member("member_owner", "group_private", "auth_owner", "owner"),
    ];
    const { ctx } = makeContext(tables, "auth_outsider");

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (getGroupLeaderboard as any)._handler(ctx, { groupId: "group_private" })
    ).rejects.toThrow();

    const source = readFileSync(resolve(import.meta.dir, "sacredBharatGroups.ts"), "utf8");
    const leaderboardSource = source.slice(
      source.indexOf("export async function getGroupLeaderboardHandler"),
      source.indexOf("async function requireOwnedGroup")
    );
    expect(leaderboardSource).toContain(".take(MAX_SACRED_BHARAT_GROUP_MEMBERS + 1)");
    expect(leaderboardSource).not.toContain(".collect()");
  });
});

describe("Sacred Bharat group-count migration", () => {
  const previousSecret = process.env.MIGRATION_SECRET;

  beforeEach(() => {
    process.env.MIGRATION_SECRET = "group-test-secret";
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.MIGRATION_SECRET;
    } else {
      process.env.MIGRATION_SECRET = previousSecret;
    }
  });

  test("backfills counts and requires an independent zero-mismatch pass", async () => {
    const tables = baseTables();
    tables.sacredBharatGroups = [group("group_one"), group("group_two", makeInviteCode(), 99)];
    tables.sacredBharatGroupMembers = [
      member("member_one", "group_one", "auth_owner", "owner"),
      member("member_two_owner", "group_two", "auth_two", "owner"),
      member("member_two_guest", "group_two", "auth_guest"),
    ];
    const { ctx, tables: state } = makeContext(tables);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const backfill = await (backfillGroupMemberCounts as any)._handler(ctx, {
      secret: "group-test-secret",
    });
    expect(backfill).toMatchObject({ converted: 2, stage: "verify", status: "running" });
    expect(state.sacredBharatGroups.map((row) => row.memberCount)).toEqual([1, 2]);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const verify = await (verifyGroupMemberCounts as any)._handler(ctx, {
      secret: "group-test-secret",
    });
    expect(verify).toMatchObject({
      legacyRemaining: 0,
      stage: "complete",
      status: "verified",
    });
    expect(state.dataMigrationRegistry[0]).toMatchObject({
      legacyRemaining: 0,
      stage: "complete",
      status: "verified",
    });
  });

  test("fails readiness when the independent pass finds projection drift", async () => {
    const tables = baseTables();
    tables.sacredBharatGroups = [group("group_one")];
    tables.sacredBharatGroupMembers = [member("member_one", "group_one", "auth_owner", "owner")];
    const { ctx, tables: state } = makeContext(tables);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (backfillGroupMemberCounts as any)._handler(ctx, { secret: "group-test-secret" });
    state.sacredBharatGroups[0].memberCount = 7;

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (verifyGroupMemberCounts as any)._handler(ctx, { secret: "group-test-secret" })
    ).resolves.toMatchObject({ legacyRemaining: 1, status: "failed" });
  });
});
